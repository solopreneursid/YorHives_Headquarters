#!/usr/bin/env python3
"""Real local Chromium smoke checks for the read-only browser assurance worker.

Only a temporary localhost HTTP fixture is contacted; no live site is probed.
"""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import sys
from pathlib import Path
import threading

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "intelligence"))
from assurance import browser_probe


class Fixture(BaseHTTPRequestHandler):
    mutations = 0

    def do_GET(self):
        cases = {
            "/working": b"<html><title>Good tool</title><body><h1>Image tool</h1><button>Compress</button></body></html>",
            "/error": b"<html><title>Error tool</title><body><h1>Tool exists</h1><script>setTimeout(() => {throw new Error('synthetic test error')}, 5)</script></body></html>",
            "/blank": b"<html><body></body></html>",
            "/background-post": b"<html><title>Tool</title><body><h1>Tool exists</h1><script>fetch('/danger', {method:'POST'}).catch(() => {})</script></body></html>",
        }
        body = cases.get(self.path, b"missing")
        self.send_response(200 if self.path in cases else 404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        Fixture.mutations += 1
        self.send_response(405)
        self.end_headers()

    def log_message(self, *args):
        pass


def main():
    Fixture.mutations = 0
    server = ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        origin = "http://127.0.0.1:" + str(server.server_address[1])
        with browser_probe(origin, allow_local=True) as check:
            good = check(origin + "/working")
            assert good["status"] == "pass", good
            bad_js = check(origin + "/error")
            assert bad_js["status"] == "fail" and bad_js["reason"] == "uncaught-javascript-error", bad_js
            blank = check(origin + "/blank")
            assert blank["status"] == "fail" and blank["reason"] == "empty-rendered-page", blank
            dangerous = check(origin + "/background-post")
            assert dangerous["blockedRequests"] >= 1, dangerous
            assert Fixture.mutations == 0, "Browser made a mutating POST"
            assert check("https://unrelated.example/tools/foo")["status"] == "blocked"
        print("PASS: read-only Chromium rendering, JavaScript exception, empty page and POST blocking")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


if __name__ == "__main__":
    main()
