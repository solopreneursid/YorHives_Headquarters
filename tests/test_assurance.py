#!/usr/bin/env python3
"""Deterministic assurance transition tests without network or browser binaries."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "intelligence"))
from assurance import _inventory, apply_results, run
from discover import connect_db

ORIGIN = "https://yorphives.example"
TOOL = ORIGIN + "/tools/image-compressor"


class BrowserAssuranceContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="yorphives-qa-contract-")
        self.addCleanup(self.tmp.cleanup)
        self.state = Path(self.tmp.name)
        self.records = [{"name": "Image Compressor", "url": TOOL}]
        self.db = connect_db(self.state)
        self.addCleanup(self.db.close)

    def verdict(self, kind, reason="synthetic-check"):
        return lambda _url: {"status": kind, "reason": reason, "httpStatus": 200,
                             "uncaughtErrors": 0, "blockedRequests": 0}

    def check(self, kind, reason="synthetic-check"):
        with self.db:
            return apply_results(self.db, self.records, self.verdict(kind, reason),
                                 "2026-11-15T00:00:00Z")

    def test_first_failure_is_pending_not_an_alert(self):
        result = self.check("fail")
        self.assertEqual(result["checks"][0]["status"], "pending_confirmation")
        self.assertEqual(result["findings"], [])
        self.assertEqual(result["summary"]["pendingConfirmation"], 1)

    def test_second_failure_creates_evidence_finding(self):
        self.check("fail")
        result = self.check("fail", "uncaught-javascript-error")
        self.assertEqual(result["checks"][0]["status"], "failed")
        self.assertEqual(result["checks"][0]["failStreak"], 2)
        self.assertEqual(len(result["findings"]), 1)
        self.assertEqual(result["findings"][0]["category"], "quality")
        self.assertEqual(result["findings"][0]["evidence"], [TOOL])

    def test_browser_blocked_is_not_health_recovery_or_new_failure(self):
        self.check("fail")
        self.check("fail")
        result = self.check("blocked", "no-browser")
        self.assertEqual(result["checks"][0]["status"], "unverified")
        self.assertEqual(result["checks"][0]["failStreak"], 2)
        self.assertFalse(result["findings"], "Unavailable browser must not invent new failures")

    def test_success_resets_confirmation_streak(self):
        self.check("fail")
        self.check("fail")
        result = self.check("pass", "page-rendered")
        self.assertEqual(result["checks"][0]["status"], "passed")
        self.assertEqual(result["checks"][0]["failStreak"], 0)
        self.check("fail")
        self.assertEqual(self.check("fail")["summary"]["confirmedFailures"], 1)

    def test_only_active_same_origin_products_enrolled(self):
        path = self.state / "product-intelligence-report.json"
        path.write_text(json.dumps({
            "schemaVersion": "yorphives.hq-intelligence.v1",
            "products": [
                {"name": "Image Compressor", "url": TOOL, "active": True},
                {"name": "External trap", "url": "https://malicious.example/tools/x", "active": True},
                {"name": "Retired", "url": ORIGIN + "/tools/old", "active": False},
                {"name": "Duplicate", "url": TOOL, "active": True}
            ]}))
        self.assertEqual(_inventory(self.state, ORIGIN), self.records)

    def test_new_product_gets_qa_in_same_cycle(self):
        path = self.state / "product-intelligence-report.json"
        path.write_text(json.dumps({
            "schemaVersion": "yorphives.hq-intelligence.v1",
            "products": [{"name": "Image Compressor", "url": TOOL, "active": True}]
        }))
        report = run(self.state, ORIGIN, probe=self.verdict("pass", "rendered"))
        self.assertEqual(report["checks"][0]["url"], TOOL)
        self.assertEqual(report["checks"][0]["status"], "passed")
        self.assertTrue((self.state / "browser-assurance-report.json").exists())

    def test_large_catalog_is_fairly_covered_across_cycles(self):
        items = [
            {"name": "Tool " + str(n), "url": ORIGIN + "/tools/t" + str(n), "active": True}
            for n in range(75)
        ]
        (self.state / "product-intelligence-report.json").write_text(json.dumps({
            "schemaVersion": "yorphives.hq-intelligence.v1", "products": items
        }))
        visited = []
        def probe(url):
            visited.append(url)
            return {"status": "pass", "reason": "rendered", "httpStatus": 200}
        first = run(self.state, ORIGIN, probe=probe)
        self.assertEqual(first["verification"]["checkedThisCycle"], 60)
        self.assertEqual(first["verification"]["notYetTested"], 15)
        second = run(self.state, ORIGIN, probe=probe)
        self.assertEqual(second["verification"]["notYetTested"], 0)
        self.assertEqual(len(second["checks"]), 75)
        self.assertEqual(len(set(visited)), 75)

    def test_confirmed_failure_stays_visible_when_probes_blocked(self):
        (self.state / "product-intelligence-report.json").write_text(json.dumps({
            "schemaVersion": "yorphives.hq-intelligence.v1",
            "products": [{"name": "Image Compressor", "url": TOOL, "active": True}]
        }))
        run(self.state, ORIGIN, probe=self.verdict("fail"))
        after_second = run(self.state, ORIGIN, probe=self.verdict("fail"))
        self.assertEqual(len(after_second["findings"]), 1)
        after_block = run(self.state, ORIGIN, probe=self.verdict("blocked", "browser-not-installed"))
        self.assertEqual(after_block["checks"][0]["status"], "unverified")
        self.assertEqual(len(after_block["findings"]), 1, "Unverified != recovered")
        recovered = run(self.state, ORIGIN, probe=self.verdict("pass"))
        self.assertEqual(recovered["findings"], [])

    def test_scanner_is_absent_cannot_claim_a_pass(self):
        with self.assertRaises(ValueError):
            _inventory(self.state, ORIGIN)


if __name__ == "__main__":
    unittest.main(verbosity=2)
