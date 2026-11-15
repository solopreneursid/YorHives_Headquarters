#!/usr/bin/env python3
"""Independent, read-only health watchdog for YorpHives Headquarters.

Run as a separate unprivileged process outside the main HQ collector.
Checks: localhost viewer HTTP auth challenge + collector evidence heartbeat.
No tokens, no file mutations in HQ, no external network, no auto-remediation.
Only writes its OWN private watchdog state folder, never the HQ evidence DB.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from http.client import HTTPConnection
import json
import os
from pathlib import Path
import sys
import time
from typing import Callable

from discover import private_storage, trimmed, utcnow

MAX_REPORT_BYTES = 2_000_000


def viewer_observation(port: int) -> tuple[bool, str]:
    """Unauthenticated HEAD must receive HQ's private Basic authentication gate."""
    conn = HTTPConnection("127.0.0.1", port, timeout=4)
    try:
        conn.request("HEAD", "/api/report")
        response = conn.getresponse()
        realm = response.getheader("WWW-Authenticate", "")
        response.read(1024)
        if response.status == 401 and 'realm="YorpHives HQ private office"' in realm:
            return True, "private-viewer-auth-gate-responding"
        return False, "viewer-did-not-prove-private-auth-gate"
    except (OSError, TimeoutError):
        return False, "viewer-unreachable"
    finally:
        conn.close()


def collector_observation(path: Path, max_age_minutes: int = 120,
                          now: datetime | None = None) -> tuple[bool, str]:
    """A recent output envelope is a heartbeat, not cryptographic proof of health."""
    now = now or datetime.now(timezone.utc)
    try:
        if not path.is_file() or path.stat().st_size > MAX_REPORT_BYTES:
            return False, "collector-report-missing-or-oversized"
        report = json.loads(path.read_bytes())
        if report.get("schemaVersion") != "yorphives.hq-intelligence.v1":
            return False, "collector-report-schema-invalid"
        pipeline = report.get("pipeline")
        if not isinstance(pipeline, dict) or pipeline.get("readOnly") is not True:
            return False, "collector-report-not-readonly"
        products = pipeline.get("products", {})
        if not isinstance(products, dict) or products.get("complete") is not True:
            return False, "latest-product-discovery-incomplete"
        stamp = pipeline.get("generatedAt")
        if not isinstance(stamp, str):
            return False, "collector-report-timestamp-missing"
        checked = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        if checked.tzinfo is None:
            return False, "collector-timestamp-unverified"
        elapsed = (now - checked.astimezone(timezone.utc)).total_seconds()
        if elapsed < -60:
            return False, "collector-timestamp-in-future"
        if elapsed > max_age_minutes * 60:
            return False, "collector-heartbeat-stale"
        return True, "collector-report-recent-and-discovery-complete"
    except (OSError, ValueError, TypeError, KeyError, UnicodeError):
        return False, "collector-report-unreadable"


def record_observations(state: Path, observations: dict[str, tuple[bool, str]],
                        now: str) -> dict:
    """Store watchdog findings independently, using two consecutive failures."""
    if state.exists() and state.stat().st_mode & 0o077:
        raise ValueError("Watchdog evidence directory must be private (0700)")
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    prior_path = state / "watchdog-report.json"
    previous = {}
    try:
        if prior_path.is_file() and prior_path.stat().st_size < 250_000:
            old = json.loads(prior_path.read_text(encoding="utf-8"))
            previous = old.get("checks", {})
            if not isinstance(previous, dict):
                previous = {}
    except (OSError, ValueError, TypeError):
        previous = {}
    entries = {}
    events = []
    for kind, (okay, reason) in observations.items():
        old = previous.get(kind, {}) if isinstance(previous.get(kind), dict) else {}
        streak = 0 if okay else int(old.get("failureStreak", 0)) + 1
        status = "healthy_observation" if okay else "confirmed_failure" if streak >= 2 else "pending_confirmation"
        entries[kind] = {
            "status": status, "reason": trimmed(reason, 100),
            "failureStreak": streak, "checkedAt": now,
            "limitations": "Availability and report freshness only; not a security or functional verification"
        }
        if streak == 2:
            events.append({"component": kind, "status": "confirmed_failure",
                           "summary": "Independent watchdog detected repeated failure: " + trimmed(reason, 100),
                           "recommendation": "Founder should independently investigate the service; do not restart or deploy automatically."})
        if okay and int(old.get("failureStreak", 0)) >= 2:
            events.append({"component": kind, "status": "observed_recovery",
                           "summary": "Independent watchdog observed recovery; verify services manually"})
    report = {
        "schemaVersion": "yorphives.hq-independent-watchdog.v1",
        "generatedAt": now,
        "checks": entries,
        "events": events,
        "readOnly": True,
        "notification": "Local report and process logs only. External alert delivery not configured."
    }
    staging = state / ".watchdog-report.tmp"
    staging.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    staging.chmod(0o600)
    staging.replace(prior_path)
    return report


def run_once(*, state: Path, collector_report: Path, port: int,
             max_age_minutes: int = 120, observer: Callable[[int], tuple[bool, str]] | None = None) -> dict:
    checker = observer or viewer_observation
    return record_observations(state, {
        "private_viewer": checker(port),
        "collector_heartbeat": collector_observation(collector_report, max_age_minutes)
    }, utcnow())


def main() -> int:
    parser = argparse.ArgumentParser(description="Independent read-only Headquarters health watchdog")
    parser.add_argument("--state-dir", default="~/.local/state/yorphives-watchdog")
    parser.add_argument("--collector-report", default="~/.local/state/yorphives-hq/headquarters-report.json")
    parser.add_argument("--viewer-port", type=int, default=8765)
    parser.add_argument("--max-age-minutes", type=int, default=120)
    parser.add_argument("--loop", action="store_true", help="Run continuously under a founder-managed process supervisor")
    parser.add_argument("--interval-minutes", type=int, default=5)
    args = parser.parse_args()
    if not 1024 <= args.viewer_port <= 65535 or args.interval_minutes < 1 or args.max_age_minutes < 5:
        parser.error("Invalid viewer port, interval or max evidence age")
    os.umask(0o077)
    try:
        state = private_storage(args.state_dir)
        evidence = Path(args.collector_report).expanduser().resolve()
        if state == evidence.parent or state in evidence.parents:
            raise ValueError("Watchdog state must be separate from HQ evidence state")
        while True:
            report = run_once(state=state, collector_report=evidence, port=args.viewer_port,
                              max_age_minutes=args.max_age_minutes)
            conditions = {k: v["status"] for k, v in report["checks"].items()}
            print(json.dumps({"at": report["generatedAt"], "health": conditions,
                              "events": report["events"]}), flush=True)
            if not args.loop:
                return 1 if any(v != "healthy_observation" for v in conditions.values()) else 0
            time.sleep(args.interval_minutes * 60)
    except KeyboardInterrupt:
        return 130
    except (OSError, ValueError, TypeError) as exc:
        print("Independent watchdog blocked: " + trimmed(exc, 250), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
