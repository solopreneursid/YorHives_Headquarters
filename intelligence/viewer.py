#!/usr/bin/env python3
"""Private, read-only HTTP viewer for the YorpHives Headquarters UI.

Serves only three approved static files and one JSON evidence report.
Runs on loopback only; use an SSH tunnel to access from another device.
Does not run detectors, mutate the repository, install software or deploy.
"""
from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit

from discover import private_storage

ROOT = Path(__file__).resolve().parents[1]
MAX_REPORT_BYTES = 2_000_000
STATIC = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/dashboard.js": ("dashboard.js", "text/javascript; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
}


def approved_report(storage: Path) -> bytes | None:
    """Only serve a fresh, recognizable read-only report. Never serve raw DB."""
    path = storage / "headquarters-report.json"
    try:
        if not path.is_file() or path.stat().st_size > MAX_REPORT_BYTES:
            return None
        data = path.read_bytes()
        if len(data) > MAX_REPORT_BYTES:
            return None
        doc = json.loads(data)
        if not isinstance(doc, dict) or doc.get("schemaVersion") != "yorphives.hq-intelligence.v1":
            return None
        pipeline = doc.get("pipeline")
        if not isinstance(pipeline, dict) or pipeline.get("readOnly") is not True:
            return None
        stamp = pipeline.get("generatedAt")
        if not isinstance(stamp, str):
            return None
        at = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        if at.tzinfo is None:
            return None
        age = (datetime.now(timezone.utc) - at.astimezone(timezone.utc)).total_seconds()
        if age < -60 or age > 3 * 3600:
            return None
        return data
    except (OSError, ValueError, KeyError, TypeError, UnicodeError):
        return None


def handler_factory(storage: Path, username: str, password: str):
    class ReadOnlyHandler(BaseHTTPRequestHandler):
        server_version = "YorpHivesHQ-PrivateViewer/0.1"
        sys_version = ""

        def authorized(self) -> bool:
            header = self.headers.get("Authorization", "")
            if not header.startswith("Basic ") or len(header) > 2048:
                return False
            try:
                decoded = base64.b64decode(header[6:], validate=True).decode("utf-8")
                supplied_user, supplied_pass = decoded.split(":", 1)
                return (hmac.compare_digest(supplied_user, username) and
                        hmac.compare_digest(supplied_pass, password))
            except (ValueError, UnicodeError):
                return False

        def finish_headers(self, content_type: str, body_len: int, status: int,
                           verified_report: bool = False) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(body_len))
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
            self.send_header("Content-Security-Policy",
                "default-src 'none'; script-src 'self'; style-src 'self'; " +
                "img-src 'self' data:; connect-src 'self'; base-uri 'none'; " +
                "frame-ancestors 'none'; form-action 'none'")
            if verified_report:
                # Header denotes a validated local report envelope, NOT cryptographic proof.
                self.send_header("X-YorpHives-HQ-Evidence", "readonly-local")
            self.end_headers()

        def respond(self, status: int, body: bytes, content_type: str = "text/plain; charset=utf-8",
                    verified_report: bool = False) -> None:
            self.finish_headers(content_type, len(body), status, verified_report)
            if self.command != "HEAD":
                self.wfile.write(body)

        def do_GET(self) -> None:
            if not self.authorized():
                body = b"Authentication required"
                self.send_response(401)
                self.send_header("WWW-Authenticate", 'Basic realm="YorpHives HQ private office", charset="UTF-8"')
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(body)
                return

            route = urlsplit(self.path).path
            if route == "/api/report":
                report = approved_report(storage)
                if report is None:
                    self.respond(503, b"No fresh verified-format local report available")
                else:
                    self.respond(200, report, "application/json; charset=utf-8", verified_report=True)
                return

            item = STATIC.get(route)
            if item is None:
                self.respond(404, b"Not found")
                return
            filename, kind = item
            source = ROOT / filename
            try:
                body = source.read_bytes()
            except OSError:
                self.respond(503, b"UI file unavailable")
                return
            self.respond(200, body, kind)

        def do_HEAD(self) -> None:
            self.do_GET()

        def do_POST(self) -> None:
            self.respond(405, b"Read-only viewer: POST not allowed")

        def do_PUT(self) -> None:
            self.respond(405, b"Read-only viewer: PUT not allowed")

        def do_PATCH(self) -> None:
            self.respond(405, b"Read-only viewer: PATCH not allowed")

        def do_DELETE(self) -> None:
            self.respond(405, b"Read-only viewer: DELETE not allowed")

        def log_message(self, fmt, *args) -> None:
            # Avoid including URLs or Basic headers in durable logs.
            if args:
                sys.stderr.write("[viewer] request completed\n")

    return ReadOnlyHandler


def create_server(storage: Path, username: str, password: str, port: int) -> ThreadingHTTPServer:
    if not username or not password or len(password) < 16:
        raise ValueError("Set HQ_VIEW_USER and HQ_VIEW_PASSWORD (>=16 characters)")
    if not storage.is_dir() or storage.stat().st_mode & 0o077:
        raise ValueError("Private evidence directory is missing or is accessible to other users")
    # Fixed loopback binding; cannot be exposed via --bind=0.0.0.0.
    return ThreadingHTTPServer(("127.0.0.1", port), handler_factory(storage, username, password))


def main() -> int:
    parser = argparse.ArgumentParser(description="Founder-only, read-only Headquarters report dashboard")
    parser.add_argument("--state-dir", default="~/.local/state/yorphives-hq")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("port must be between 1024 and 65535")
    try:
        storage = private_storage(args.state_dir)
        server = create_server(storage, os.environ.get("HQ_VIEW_USER", ""),
                               os.environ.get("HQ_VIEW_PASSWORD", ""), args.port)
        print("Private read-only HQ viewer listening on http://127.0.0.1:" + str(args.port), flush=True)
        print("Use an authenticated SSH tunnel for remote access; do not expose port directly.", flush=True)
        try:
            server.serve_forever(poll_interval=0.5)
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
        return 0
    except (OSError, ValueError) as exc:
        print("Private HQ viewer blocked: " + str(exc)[:240], file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
