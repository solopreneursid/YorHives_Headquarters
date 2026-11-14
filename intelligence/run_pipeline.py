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

from discover import private_storage, scan, utcnow
from research import run as research_run, DEFAULT_CONFIG
from compare import compare as competitor_compare


def combine(products: dict, growth: dict | None, comparisons: dict | None, errors: list[str]) -> dict:
    report = dict(products)
    if growth is not None:
        report["opportunities"] = growth.get("opportunities", [])[:80]
        report["comparisons"] = growth.get("comparisons", [])[:80]
    else:
        report["opportunities"] = []
        report["comparisons"] = []
    if comparisons is not None:
        report["comparisons"] = comparisons.get("comparisons", [])[:80]
    report["pipeline"] = {
        "generatedAt": utcnow(),
        "products": products.get("verification", {}),
        "research": growth.get("verification", {}) if growth else {"status": "not-completed"},
        "competitors": comparisons.get("verification", {}) if comparisons else {"status": "not-completed"},
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
    args = parser.parse_args()
    if args.interval_minutes < 15 or args.research_every < 1 or args.compare_every < 1:
        parser.error("Use interval >=15 minutes and research-every >=1")
    state = private_storage(args.state_dir)
    counter = 0
    try:
        while True:
            errors = []
            products = None
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
                report = combine(products, growth, comparisons, errors)
                path = write_combined(state, report)
                print(json.dumps({"at": report["pipeline"]["generatedAt"], "products": len(report.get("products", [])),
                                  "leads": len(report.get("opportunities", [])), "warnings": errors,
                                  "report": str(path)}), flush=True)
            counter += 1
            if not args.loop:
                break
            time.sleep(args.interval_minutes * 60)
    except KeyboardInterrupt:
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
