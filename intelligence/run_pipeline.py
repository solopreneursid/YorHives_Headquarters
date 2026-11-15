#!/usr/bin/env python3
"""Combine private read-only product monitoring and growth research evidence.

On any research-feed failure, do NOT invent opportunities or claim successful
market validation. All writes stay in the separate private evidence directory.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time

from discover import private_storage, connect_db, scan, utcnow
from browser_discover import browser_discover
from research import run as research_run, DEFAULT_CONFIG
from compare import compare as competitor_compare
from assurance import run as assurance_run


def combine(products: dict, growth: dict | None, comparisons: dict | None, assurance: dict | None, errors: list[str]) -> dict:
    report = dict(products)
    if growth is not None:
        report["opportunities"] = growth.get("opportunities", [])[:80]
        report["comparisons"] = growth.get("comparisons", [])[:80]
    else:
        report["opportunities"] = []
        report["comparisons"] = []
    if comparisons is not None:
        report["comparisons"] = comparisons.get("comparisons", [])[:80]
    report["checks"] = []
    if assurance is not None:
        report["checks"] = assurance.get("checks", [])[:60]
        report["findings"] = (report.get("findings", []) + assurance.get("findings", []))[:200]
        checked = {item.get("url"): item for item in report["checks"] if isinstance(item, dict)}
        for product in report.get("products", []):
            check = checked.get(product.get("url"))
            if check:
                product["qaStatus"] = check.get("status", "unverified")
                product["qaCheckedAt"] = check.get("checkedAt", "")
                product["qaReason"] = check.get("reason", "")
    report["pipeline"] = {
        "generatedAt": utcnow(),
        "products": products.get("verification", {}),
        "research": growth.get("verification", {}) if growth else {"status": "not-completed"},
        "competitors": comparisons.get("verification", {}) if comparisons else {"status": "not-completed"},
        "assurance": assurance.get("verification", {}) if assurance else {"status": "not-completed"},
        "errors": errors,
        "readOnly": True,
        "approvalRequired": True
    }
    return report


def write_combined(state: Path, report: dict) -> Path:
    output = state / "headquarters-report.json"
    staging = state / ".headquarters-report.tmp"
    staging.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    staging.chmod(0o600)
    staging.replace(output)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="YorpHives autonomous discovery, read-only monitoring and research")
    parser.add_argument("--base-url", default="https://yorphives.com")
    parser.add_argument("--state-dir", default="~/.local/state/yorphives-hq")
    parser.add_argument("--research-sources", default=str(DEFAULT_CONFIG))
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval-minutes", type=int, default=60)
    parser.add_argument("--research-every", type=int, default=6, help="Run feed research every N scans; default 6")
    parser.add_argument("--compare-every", type=int, default=24, help="Recheck allowlisted competitors every N scans; default 24")
    parser.add_argument("--allow-local", action="store_true", help="Localhost only, for tests")
    parser.add_argument("--browser-discovery", action="store_true", help="Use optional Playwright to discover client-rendered tool links")
    parser.add_argument("--browser-every", type=int, default=6, help="When enabled, browser discovery every N scans")
    parser.add_argument("--assurance-browser", action="store_true", help="Opt in to read-only browser assurance on discovered tools")
    parser.add_argument("--assurance-every", type=int, default=6, help="When enabled, browser QA every N scans")
    args = parser.parse_args()
    if args.interval_minutes < 15 or args.research_every < 1 or args.compare_every < 1 or args.browser_every < 1 or args.assurance_every < 1:
        parser.error("Use interval >=15 minutes and research-every >=1")
    state = private_storage(args.state_dir)
    if args.browser_discovery or args.assurance_browser:
        # Create only the separate evidence database directory, never a project directory.
        initial_db = connect_db(state)
        initial_db.close()
    counter = 0
    try:
        while True:
            errors = []
            products = None
            if args.browser_discovery and counter % args.browser_every == 0:
                try:
                    browser = browser_discover(args.base_url, state)
                    if browser.get("successfulHubs", 0) == 0:
                        errors.append("Browser discovery did not load a hub")
                except Exception as exc:
                    errors.append("Browser discovery unavailable: " + str(exc)[:180])
            try:
                products = scan(args.base_url, state, allow_local=args.allow_local)
            except Exception as exc:
                errors.append("Product discovery unavailable: " + str(exc)[:180])
            growth = None
            if counter % args.research_every == 0:
                try:
                    growth = research_run(state, Path(args.research_sources))
                    if growth.get("verification", {}).get("successfulFeeds", 0) == 0:
                        errors.append("Research has no successful feeds")
                except Exception as exc:
                    errors.append("Research unavailable: " + str(exc)[:180])
            else:
                path = state / "growth-research-report.json"
                if path.is_file():
                    try:
                        previous = json.loads(path.read_text(encoding="utf-8"))
                        then = datetime.fromisoformat(previous["generatedAt"].replace("Z", "+00:00"))
                        if (datetime.now(timezone.utc) - then).total_seconds() < 24 * 3600:
                            growth = previous
                        else:
                            errors.append("Research report expired; refresh required")
                    except (ValueError, KeyError, OSError, TypeError):
                        errors.append("Research report is unreadable")
            comparisons = None
            if counter % args.compare_every == 0:
                try:
                    comparisons = competitor_compare(state, Path(args.research_sources))
                except Exception as exc:
                    errors.append("Competitor watch unavailable: " + str(exc)[:180])
            else:
                stored = state / "competitive-report.json"
                if stored.is_file():
                    try:
                        previous = json.loads(stored.read_text(encoding="utf-8"))
                        then = datetime.fromisoformat(previous["generatedAt"].replace("Z", "+00:00"))
                        if (datetime.now(timezone.utc) - then).total_seconds() < 48 * 3600:
                            comparisons = previous
                        else:
                            errors.append("Competitor report expired; refresh required")
                    except (ValueError, KeyError, OSError, TypeError):
                        errors.append("Competitor report is unreadable")
            assurance = None
            if args.assurance_browser and products is not None and counter % args.assurance_every == 0:
                try:
                    assurance = assurance_run(state, args.base_url, allow_local=args.allow_local)
                except Exception as exc:
                    errors.append("Browser assurance unavailable: " + str(exc)[:180])
            elif args.assurance_browser:
                stored = state / "browser-assurance-report.json"
                if stored.is_file():
                    try:
                        previous = json.loads(stored.read_text(encoding="utf-8"))
                        then = datetime.fromisoformat(previous["generatedAt"].replace("Z", "+00:00"))
                        if (datetime.now(timezone.utc) - then).total_seconds() < 12 * 3600 and previous.get("origin") == args.base_url:
                            assurance = previous
                        else:
                            errors.append("Browser assurance report expired or from different origin")
                    except (ValueError, KeyError, OSError, TypeError):
                        errors.append("Browser assurance report unreadable")
            if products is None:
                # Don't overwrite a previously successful product report with an empty inventory.
                prior = state / "product-intelligence-report.json"
                if prior.exists():
                    try:
                        products = json.loads(prior.read_text(encoding="utf-8"))
                        products["verification"]["complete"] = False
                        errors.append("Using previous product snapshot; it is not a fresh health check")
                    except (ValueError, KeyError, OSError, TypeError):
                        products = None
            if products is None:
                print("BLOCKED: no valid product inventory report. " + "; ".join(errors), file=sys.stderr, flush=True)
                if not args.loop:
                    return 2
            else:
                if not products.get("verification", {}).get("complete", False):
                    errors.append("Product discovery incomplete; do not trust inventory coverage")
                report = combine(products, growth, comparisons, assurance, errors)
                path = write_combined(state, report)
                print(json.dumps({"at": report["pipeline"]["generatedAt"], "products": len(report.get("products", [])),
                                  "leads": len(report.get("opportunities", [])), "warnings": errors,
                                  "report": str(path)}), flush=True)
            counter += 1
            if not args.loop:
                return 2 if errors else 0
            time.sleep(args.interval_minutes * 60)
    except KeyboardInterrupt:
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
