#!/usr/bin/env python3
"""Local-only, no-network-external contract tests for the private HQ viewer."""
from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
from http.client import HTTPConnection
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "intelligence"))
from viewer import create_server


class ViewerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="yorphives-hq-viewer-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.report = self.root / "headquarters-report.json"
        self.write_report()
        self.server = create_server(self.root, "founder", "private-test-password-123", 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.cleanup_server)

    def cleanup_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)

    def write_report(self, *, age_hours=0, valid=True):
        now = datetime.now(timezone.utc) - timedelta(hours=age_hours)
        document = {
            "schemaVersion": "yorphives.hq-intelligence.v1" if valid else "untrusted",
            "pipeline": {"readOnly": True, "generatedAt": now.isoformat()},
            "assets": [], "products": [], "changes": [], "comparisons": [],
            "findings": [], "opportunities": [], "agents": [], "activity": []
        }
        self.report.write_text(json.dumps(document), encoding="utf-8")
        self.report.chmod(0o600)

    def request(self, method, path, auth=True):
        connection = HTTPConnection("127.0.0.1", self.server.server_address[1], timeout=5)
        headers = {}
        if auth:
            token = base64.b64encode(b"founder:private-test-password-123").decode("ascii")
            headers["Authorization"] = "Basic " + token
        connection.request(method, path, headers=headers)
        result = connection.getresponse()
        body = result.read()
        status = result.status
        headers = dict(result.getheaders())
        connection.close()
        return status, body, headers

    def test_binds_to_loopback_only(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")

    def test_rejects_requests_without_authentication(self):
        status, _, headers = self.request("GET", "/", auth=False)
        self.assertEqual(status, 401)
        self.assertIn("Basic", headers.get("WWW-Authenticate", ""))

    def test_ui_is_served_with_security_headers(self):
        status, body, headers = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"YorpHives", body)
        self.assertIn("default-src 'none'", headers.get("Content-Security-Policy", ""))
        self.assertEqual(headers.get("Cache-Control"), "no-store, max-age=0")
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_private_api_serves_readonly_evidence(self):
        status, body, headers = self.request("GET", "/api/report")
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("X-YorpHives-HQ-Evidence"), "readonly-local")
        obj = json.loads(body)
        self.assertTrue(obj["pipeline"]["readOnly"])

    def test_rejects_stale_and_untrusted_evidence(self):
        self.write_report(age_hours=4)
        status, _, _ = self.request("GET", "/api/report")
        self.assertEqual(status, 503)
        self.write_report(valid=False)
        status, _, _ = self.request("GET", "/api/report")
        self.assertEqual(status, 503)

    def test_rejects_write_methods(self):
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            status, _, _ = self.request(method, "/api/report")
            self.assertEqual(status, 405, method)

    def test_whitelists_exact_static_files_only(self):
        for path in ("/README.md", "/.git/config", "/intelligence/discover.py", "/.env", "/api/secrets"):
            status, _, _ = self.request("GET", path)
            self.assertEqual(status, 404, path)

    def test_rejects_short_or_missing_password(self):
        with self.assertRaises(ValueError):
            srv = create_server(self.root, "founder", "", 0)
        with self.assertRaises(ValueError):
            srv = create_server(self.root, "founder", "12345678", 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
