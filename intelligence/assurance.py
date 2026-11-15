#!/usr/bin/env python3
"""Read-only synthetic browser assurance for automatically discovered products.

A probe only GETs pages, reads the DOM and observes uncaught JavaScript errors.
It does NOT click, submit, write, fix, or prove any advertised tool feature.
All SQLite and report writes are in a separate private evidence directory.
"""
from __future__ import annotations

import argparse
import hashlib
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import sys
import time
from typing import Callable, Iterator
from urllib.parse import urlsplit

from discover import canonical, connect_db, private_storage, trimmed, utcnow

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

MAX_PROBES = 60
MAX_REPORT_BYTES = 2_000_000
CHECK_TIMEOUT_MS = 12000
VALID_RAW_STATES = ("pass", "fail", "blocked")


def same_origin(candidate: str, origin: str) -> bool:
    return bool(candidate and canonical(candidate, origin) == candidate)


def _result(status: str, reason: str, http_status: int | None = None,
            rendered_chars: int = 0, errors: int = 0, blocked: int = 0) -> dict:
    return {
        "status": status if status in VALID_RAW_STATES else "blocked",
        "reason": trimmed(reason, 100),
        "httpStatus": http_status,
        "renderedCharacters": max(0, min(int(rendered_chars), 999999)),
        "uncaughtErrors": max(0, min(int(errors), 99)),
        "blockedRequests": max(0, min(int(blocked), 9999))
    }


@contextmanager
def browser_probe(origin: str, allow_local: bool = False) -> Iterator[Callable[[str], dict]]:
    """One isolated browser context with read-only and same-origin egress rules."""
    parsed = urlsplit(origin)
    if parsed.scheme != "https" and not (allow_local and parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost")):
        raise ValueError("Browser probes require HTTPS (localhost HTTP only with --allow-local)")
    if sync_playwright is None:
        raise RuntimeError("Playwright is not installed. No synthetic checks were performed.")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                service_workers="block", accept_downloads=False,
                viewport={"width": 1280, "height": 720},
                java_script_enabled=True
            )
            try:
                def probe(url: str) -> dict:
                    if not same_origin(url, origin):
                        return _result("blocked", "off-origin-url-rejected")
                    page = context.new_page()
                    blocked = [0]
                    errors = [0]
                    def guard(route):
                        request = route.request
                        target = urlsplit(request.url)
                        if (request.method not in ("GET", "HEAD") or target.scheme != parsed.scheme or
                                target.hostname != parsed.hostname or target.port != parsed.port):
                            blocked[0] += 1
                            route.abort()
                        else:
                            route.continue_()
                    page.route("**/*", guard)
                    page.on("pageerror", lambda _err: errors.__setitem__(0, errors[0] + 1))
                    try:
                        response = page.goto(url, wait_until="domcontentloaded", timeout=CHECK_TIMEOUT_MS)
                        # A bounded short wait catches immediate hydration exceptions while
                        # avoiding arbitrary clicks/automated interactions.
                        page.wait_for_timeout(250)
                        if not response:
                            return _result("fail", "missing-navigation-response", errors=errors[0], blocked=blocked[0])
                        code = response.status
                        if not 200 <= code < 300:
                            return _result("fail", "non-success-page-response", code, errors=errors[0], blocked=blocked[0])
                        final_url = canonical(page.url, origin)
                        if final_url is None or urlsplit(page.url).hostname != parsed.hostname:
                            return _result("fail", "unsafe-navigation-target", code, errors=errors[0], blocked=blocked[0])
                        stats = page.evaluate("""() => ({
                          chars: ((document.body && document.body.innerText) || '').trim().length,
                          title: (document.title || '').trim().length,
                          controls: document.querySelectorAll('button,input,select,textarea,a[href]').length
                        })""")
                        chars = int(stats.get("chars", 0))
                        if not chars and not stats.get("controls", 0):
                            return _result("fail", "empty-rendered-page", code, chars, errors[0], blocked[0])
                        if errors[0]:
                            return _result("fail", "uncaught-javascript-error", code, chars, errors[0], blocked[0])
                        return _result("pass", "rendered-without-uncaught-errors", code, chars, 0, blocked[0])
                    except Exception as exc:
                        # Never serialize raw runtime error strings: they may include
                        # session identifiers, arbitrary URL query values or sensitive DOM.
                        name = type(exc).__name__
                        reason = "navigation-timeout" if "Timeout" in name else "browser-observation-error"
                        return _result("fail", reason, errors=errors[0], blocked=blocked[0])
                    finally:
                        page.close()
                yield probe
            finally:
                context.close()
        finally:
            browser.close()


def _inventory(state: Path, origin: str) -> list[dict]:
    source = state / "product-intelligence-report.json"
    if not source.is_file() or source.stat().st_size > MAX_REPORT_BYTES:
        raise ValueError("No usable product inventory report; run discovery first")
    payload = json.loads(source.read_text(encoding="utf-8"))
    if payload.get("schemaVersion") != "yorphives.hq-intelligence.v1":
        raise ValueError("Product inventory schema unsupported")
    raw = payload.get("products")
    if not isinstance(raw, list):
        raise ValueError("Product inventory is missing")
    products = []
    urls = set()
    for item in raw:
        if not isinstance(item, dict) or item.get("active") is not True:
            continue
        url = item.get("url")
        if not isinstance(url, str) or url in urls or not same_origin(url, origin):
            continue
        urls.add(url)
        products.append({"url": url, "name": trimmed(item.get("name"), 150) or "Unnamed tool"})
    return products


def _ensure_table(db: sqlite3.Connection) -> None:
    db.execute("""CREATE TABLE IF NOT EXISTS browser_assurance (
      url TEXT PRIMARY KEY, status TEXT NOT NULL, fail_streak INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL, last_checked TEXT NOT NULL, last_http INTEGER,
      uncaught_errors INTEGER NOT NULL DEFAULT 0, blocked_requests INTEGER NOT NULL DEFAULT 0
    )""")


def apply_results(db: sqlite3.Connection, inputs: list[dict], probe: Callable[[str], dict],
                  now: str) -> dict:
    """Deterministic alert suppression and result processing, safe for fake probes."""
    _ensure_table(db)
    checks = []
    findings = []
    passed = failed = pending = blocked = 0
    for item in inputs[:MAX_PROBES]:
        url, name = item["url"], trimmed(item["name"], 150)
        previous = db.execute("SELECT * FROM browser_assurance WHERE url=?", (url,)).fetchone()
        result = probe(url)
        raw = result.get("status", "blocked")
        if raw not in VALID_RAW_STATES:
            raw = "blocked"
        old_streak = int(previous["fail_streak"]) if previous else 0
        # If browser is unavailable or evidence is blocked, do not treat it as
        # proof of a failure or as proof of recovery.
        if raw == "blocked":
            streak = old_streak
            state = "unverified"
            blocked += 1
        elif raw == "pass":
            streak = 0
            state = "passed"
            passed += 1
        else:
            streak = old_streak + 1
            state = "failed" if streak >= 2 else "pending_confirmation"
            if streak >= 2:
                failed += 1
            else:
                pending += 1
        reason = trimmed(result.get("reason"), 100)
        code = result.get("httpStatus")
        if not isinstance(code, int) or isinstance(code, bool) or not 100 <= code <= 599:
            code = None
        errors = result.get("uncaughtErrors", 0)
        errors = errors if isinstance(errors, int) and not isinstance(errors, bool) else 0
        blocked_reqs = result.get("blockedRequests", 0)
        blocked_reqs = blocked_reqs if isinstance(blocked_reqs, int) and not isinstance(blocked_reqs, bool) else 0
        db.execute("""INSERT INTO browser_assurance(url,status,fail_streak,reason,last_checked,last_http,uncaught_errors,blocked_requests)
            VALUES(?,?,?,?,?,?,?,?)
            ON CONFLICT(url) DO UPDATE SET status=excluded.status, fail_streak=excluded.fail_streak,
            reason=excluded.reason, last_checked=excluded.last_checked, last_http=excluded.last_http,
            uncaught_errors=excluded.uncaught_errors, blocked_requests=excluded.blocked_requests""",
            (url, state, streak, reason, now, code, errors, blocked_reqs))
        check = {"url": url, "name": name, "status": state, "reason": reason,
                 "failStreak": streak, "checkedAt": now, "httpStatus": code,
                 "uncaughtErrors": errors, "blockedRequests": blocked_reqs,
                 "scope": "read-only-browser-render-and-runtime-errors",
                 "notTested": "Interactive tool functionality, user accounts, forms and business outcomes"}
        checks.append(check)
        if state == "failed":
            findings.append({
                "id": "browser-qa-" + hashlib.sha256(url.encode()).hexdigest()[:16],
                "title": "Repeated browser-render failure: " + name,
                "category": "quality", "priority": "high",
                "asset": name, "description": (
                    "Read-only browser observation failed on at least two consecutive checks (" + reason +
                    "). This is not a feature-level or security audit."
                ),
                "recommendation": "Investigate rendering and JavaScript errors using an isolated, authorized test environment. Founder review required; no project changes are made.",
                "observedAt": now, "evidence": [url]
            })
    return {"checks": checks, "findings": findings, "summary": {
        "passed": passed, "confirmedFailures": failed,
        "pendingConfirmation": pending, "unverified": blocked
    }}


def schedule_probes(db: sqlite3.Connection, products: list[dict]) -> list[dict]:
    """Prefer newly discovered routes, then unresolved first failures, then oldest checks.

    A fixed first-N slice would permanently starve late-added products once the
    catalog exceeded the scan budget. This queue eventually covers all routes.
    """
    _ensure_table(db)
    previous = {row["url"]: row for row in db.execute("SELECT * FROM browser_assurance").fetchall()}
    def order(item: dict):
        last = previous.get(item["url"])
        priority = 0 if last is None else 1 if last["status"] == "pending_confirmation" else 2
        return priority, last["last_checked"] if last else "", item["url"]
    return sorted(products, key=order)[:MAX_PROBES]


def aggregate_known_checks(db: sqlite3.Connection, products: list[dict], now: str) -> tuple[list[dict], list[dict]]:
    """Show all catalog items, but never describe stale browser evidence as fresh."""
    rows = {row["url"]: row for row in db.execute("SELECT * FROM browser_assurance").fetchall()}
    checks, active_findings = [], []
    now_dt = datetime.fromisoformat(now.replace("Z", "+00:00"))
    for item in products:
        row = rows.get(item["url"])
        if row is None:
            checks.append({"url": item["url"], "name": item["name"], "status": "unverified",
                           "reason": "not-yet-tested", "failStreak": 0, "checkedAt": "",
                           "scope": "read-only-browser-render-and-runtime-errors"})
            continue
        try:
            at = datetime.fromisoformat(row["last_checked"].replace("Z", "+00:00"))
            fresh = 0 <= (now_dt - at).total_seconds() < 12 * 3600
        except (ValueError, TypeError):
            fresh = False
        visible = row["status"] if fresh else "unverified"
        reason = row["reason"] if fresh else "browser-observation-stale"
        checks.append({"url": item["url"], "name": item["name"], "status": visible,
                       "reason": reason, "failStreak": row["fail_streak"],
                       "checkedAt": row["last_checked"], "httpStatus": row["last_http"],
                       "uncaughtErrors": row["uncaught_errors"],
                       "blockedRequests": row["blocked_requests"],
                       "scope": "read-only-browser-render-and-runtime-errors"})
        if row["fail_streak"] >= 2:
            active_findings.append({
                "id": "browser-qa-" + hashlib.sha256(item["url"].encode()).hexdigest()[:16],
                "title": "Unresolved browser-render failure: " + item["name"],
                "category": "quality", "priority": "high", "asset": item["name"],
                "description": ("At least two consecutive read-only browser checks previously failed. " +
                                ("Latest browser attempt was unavailable or blocked." if row["status"] == "unverified" else
                                 "Last observation is stale; retest required." if not fresh else
                                 "Reason: " + row["reason"]) +
                                " No tool functionality or security claim is implied."),
                "recommendation": "Review the failing page in an isolated test session and obtain a confirmed passing check before closing this finding.",
                "observedAt": row["last_checked"], "evidence": [item["url"]]
            })
    return checks, active_findings


def run(state: Path, origin: str, *, probe: Callable[[str], dict] | None = None,
        allow_local: bool = False) -> dict:
    products = _inventory(state, origin)
    now = utcnow()
    if probe is None:
        with browser_probe(origin, allow_local=allow_local) as browser:
            return _persist(state, products, browser, now, origin)
    return _persist(state, products, probe, now, origin)


def _persist(state: Path, products: list[dict], probe: Callable[[str], dict],
             now: str, origin: str) -> dict:
    db = connect_db(state)
    try:
        with db:
            scheduled = schedule_probes(db, products)
            result = apply_results(db, scheduled, probe, now)
            checks, outstanding = aggregate_known_checks(db, products, now)
        report = {
            "schemaVersion": "yorphives.hq-browser-assurance.v1",
            "generatedAt": now, "origin": origin,
            "verification": {
                "method": "isolated-readonly-chromium-dom-observation",
                "assets": len(products),
                "checkedThisCycle": len(scheduled),
                "reportedCoverage": sum(bool(check.get("checkedAt")) for check in checks),
                "notYetTested": sum(not check.get("checkedAt") for check in checks),
                "limitations": "Does not click/submit or verify advertised features; results require independent QA and founder review.",
                **result["summary"]
            },
            "checks": checks, "findings": outstanding
        }
        out = state / "browser-assurance-report.json"
        stage = state / ".browser-assurance-report.tmp"
        stage.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        stage.chmod(0o600)
        stage.replace(out)
        return report
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only browser checks of auto-discovered YorpHives products")
    parser.add_argument("--base-url", default="https://yorphives.com")
    parser.add_argument("--state-dir", default="~/.local/state/yorphives-hq")
    parser.add_argument("--allow-local", action="store_true", help="Only for controlled localhost tests")
    args = parser.parse_args()
    os.umask(0o077)
    try:
        report = run(private_storage(args.state_dir), args.base_url, allow_local=args.allow_local)
        print(json.dumps({"at": report["generatedAt"], "checks": len(report["checks"]),
                          "summary": report["verification"]}), flush=True)
        return 0 if report["verification"]["unverified"] == 0 else 2
    except (OSError, ValueError, RuntimeError, sqlite3.Error) as exc:
        print("Browser assurance blocked: " + trimmed(exc, 250), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
