#!/usr/bin/env python3
"""Offline integration tests for independent, read-only HQ self-monitoring."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "intelligence"))

from viewer import create_server
from watchdog import collector_observation, record_observations, run_once, viewer_observation


class IndependentWatchdogTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="yorphives-watchdog-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.hq = self.root / "hq"
        self.hq.mkdir(mode=0o700)
        self.watchdog = self.root / "watchdog"
        self.evidence = self.hq / "headquarters-report.json"
        self.write_report()

    def write_report(self, *, age=0, complete=True):
        stamp = datetime.now(timezone.utc) - timedelta(minutes=age)
        data = {"schemaVersion": "yorphives.hq-intelligence.v1",
                "pipeline": {"readOnly": True, "generatedAt": stamp.isoformat(),
                             "products": {"complete": complete}},
                "products": [], "findings": [], "opportunities": []}
        self.evidence.write_text(json.dumps(data), encoding="utf-8")
        self.evidence.chmod(0o600)

    def test_recent_complete_report_is_a_heartbeat_not_full_health(self):
        okay, reason = collector_observation(self.evidence)
        self.assertTrue(okay)
        self.assertIn("discovery-complete", reason)

    def test_incomplete_discovery_is_not_marked_healthy(self):
        self.write_report(complete=False)
        self.assertEqual(collector_observation(self.evidence)[0], False)

    def test_expired_report_is_rejected(self):
        self.write_report(age=130)
        okay, reason = collector_observation(self.evidence)
        self.assertFalse(okay)
        self.assertEqual(reason, "collector-heartbeat-stale")

    def test_two_consecutive_failures_produce_one_recommendation(self):
        outcomes = {"private_viewer": (False, "viewer-unreachable"),
                    "collector_heartbeat": (True, "healthy")}
        first = record_observations(self.watchdog, outcomes, "2026-11-15T00:00:00Z")
        self.assertEqual(first["checks"]["private_viewer"]["status"], "pending_confirmation")
        second = record_observations(self.watchdog, outcomes, "2026-11-15T00:05:00Z")
        self.assertEqual(second["checks"]["private_viewer"]["status"], "confirmed_failure")
        self.assertEqual(len(second["events"]), 1)
        third = record_observations(self.watchdog, outcomes, "2026-11-15T00:10:00Z")
        self.assertEqual(third["events"], [])
        self.assertTrue((self.watchdog / "watchdog-report.json").exists())

    def test_recovery_is_an_observation_not_a_deployment(self):
        outcomes = {"private_viewer": (False, "viewer-unreachable")}
        record_observations(self.watchdog, outcomes, "2026-11-15T00:00:00Z")
        record_observations(self.watchdog, outcomes, "2026-11-15T00:05:00Z")
        restored = record_observations(self.watchdog, {"private_viewer": (True, "auth-gate-ok")}, "2026-11-15T00:10:00Z")
        self.assertEqual(restored["checks"]["private_viewer"]["failureStreak"], 0)
        self.assertEqual(restored["events"][0]["status"], "observed_recovery")

    def test_detects_authenticated_viewer_without_password(self):
        server = create_server(self.hq, "founder", "private-test-password-123", 0)
        import threading
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            status, reason = viewer_observation(server.server_address[1])
            self.assertTrue(status)
            self.assertEqual(reason, "private-viewer-auth-gate-responding")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)

    def test_run_once_writes_only_watchdog_directory(self):
        result = run_once(state=self.watchdog, collector_report=self.evidence, port=8765,
                          observer=lambda _port: (True, "auth-gate-ok"))
        self.assertEqual(result["checks"]["collector_heartbeat"]["status"], "healthy_observation")
        self.assertEqual(result["checks"]["private_viewer"]["status"], "healthy_observation")
        self.assertFalse((self.hq / "watchdog-report.json").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
