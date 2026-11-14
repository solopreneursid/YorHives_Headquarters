#!/usr/bin/env python3
"""Read-only, local browser smoke tests. Uses OSS Playwright + Chromium.
Install: python3 -m pip install playwright && python3 -m playwright install chromium
Run from repository: python3 tests/ui_smoke.py
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading

try:
    from playwright.sync_api import sync_playwright
except ImportError as exc:
    raise SystemExit("BLOCKED: Playwright is not installed. Install it before claiming browser tests passed.") from exc

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / ".review-tools" / "reports"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def main():
    REPORTS.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                context = browser.new_context(viewport={"width": 1440, "height": 1000})
                page = context.new_page()
                remote = []
                failures = []
                page.on("request", lambda request: remote.append(request.url) if not request.url.startswith(base) else None)
                page.on("pageerror", lambda error: failures.append(str(error)))
                page.goto(base + "/", wait_until="networkidle")
                assert page.locator("#view-overview").is_visible(), "Overview hidden"
                assert "Preview" in page.locator("#data-notice").inner_text(), "Missing sample-data label"
                page.screenshot(path=str(REPORTS / "headquarters-desktop.png"), full_page=True)

                page.locator('button[data-nav="monitoring"]').first.click()
                assert page.locator("#view-monitoring").is_visible(), "Monitoring inaccessible"
                assert page.locator("#findings-list .finding-row").count() == 3
                page.locator('[data-finding-filter="security"]').click()
                assert page.locator("#findings-list .finding-row").count() == 1, "Findings filter failed"

                page.locator('button[data-nav="opportunities"]').first.click()
                assert page.locator("#view-opportunities").is_visible()
                assert page.locator("#opportunities-grid .opportunity-card").count() == 3
                page.locator('[data-opportunity-filter="technology"]').click()
                assert page.locator("#opportunities-grid .opportunity-card").count() == 1

                page.locator('button[data-nav="overview"]').first.click()
                hostile = {
                    "assets": [{"name": "Demo", "status": "unknown"}],
                    "findings": [{
                        "title": '<img src=x onerror="window.ATTACKED=true">',
                        "category": "security", "priority": "high", "asset": "Demo",
                        "description": "Safe text display expected", "recommendation": "Review evidence",
                        "evidence": ["javascript:alert(1)", "https://example.org/source"]
                    }],
                    "opportunities": [], "agents": [], "activity": []
                }
                page.locator("#report-upload").set_input_files({
                    "name": "local-report.json", "mimeType": "application/json",
                    "buffer": json.dumps(hostile).encode("utf-8")
                })
                assert page.locator("#mode-label").inner_text() == "Imported data"
                assert page.locator("#priority-list .priority-item").count() == 1
                assert page.locator("img[src='x']").count() == 0, "Unsafe HTML element created"
                assert page.evaluate("window.ATTACKED === true") is False
                page.locator("#priority-list .priority-item").first.click()
                assert page.locator("#detail-dialog").is_visible()
                assert page.locator("#detail-evidence a").count() == 1, "Unsafe URL protocol was not filtered"
                assert page.locator("#detail-evidence a").first.get_attribute("href").startswith("https:")
                page.locator("#detail-close").click()

                # Exercise responsive mobile menu with a clean browser context.
                mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
                mobile_page = mobile.new_page()
                mobile_page.goto(base + "/", wait_until="networkidle")
                mobile_page.locator("#mobile-menu").click()
                assert mobile_page.locator("#sidebar").is_visible()
                mobile_page.locator('button[data-nav="governance"]').first.click()
                assert mobile_page.locator("#view-governance").is_visible()
                mobile_page.screenshot(path=str(REPORTS / "headquarters-mobile.png"), full_page=True)

                assert not failures, "Uncaught browser errors: " + repr(failures)
                assert not remote, "External browser requests detected: " + repr(remote)
                browser.close()
        finally:
            server.shutdown()
    print("PASS: desktop/navigation/filters/import/XSS/URL/mobile/network smoke tests")
    print("Screenshots written to ignored local directory: " + str(REPORTS))


if __name__ == "__main__":
    main()
