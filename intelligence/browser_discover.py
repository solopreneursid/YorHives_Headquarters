#!/usr/bin/env python3
"""Optional read-only browser fallback for client-rendered YorpHives catalogs.

Uses the open-source Playwright library and Chromium, only on founder-owned
YorpHives pages. Aborts all non-GET/HEAD requests and off-origin requests,
never clicks a button, submits a form, or modifies a website/project.
Stores links only in an external private evidence directory.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
import sys

from discover import HUB_PATHS, MAX_URLS, canonical, is_product, private_storage, utcnow

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None


def browser_discover(origin: str, storage: Path) -> dict:
    if sync_playwright is None:
        raise RuntimeError("Playwright Python package is not installed; browser discovery was not run.")
    host = urlsplit(origin)
    if host.scheme != "https" or host.hostname not in ("yorphives.com", "www.yorphives.com"):
        raise ValueError("Browser discovery is restricted to public YorpHives origins")
    found: dict[str, dict] = {}
    notes = []
    successful_hubs = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(service_workers="block", accept_downloads=False,
                                          java_script_enabled=True,
                                          viewport={"width": 1280, "height": 800})
            def guard(route):
                request = route.request
                u = urlsplit(request.url)
                if (request.method not in ("GET", "HEAD") or u.scheme != host.scheme or
                    u.hostname != host.hostname or u.port != host.port):
                    route.abort()
                else:
                    route.continue_()
            context.route("**/*", guard)
            page = context.new_page()
            for path in HUB_PATHS:
                try:
                    response = page.goto(origin + path, wait_until="domcontentloaded", timeout=15000)
                    if not response or response.status != 200:
                        continue
                    page.wait_for_timeout(1500)
                    successful_hubs += 1
                    candidates = page.evaluate("""() => [...document.querySelectorAll('a[href]')].slice(0, 600)
                        .map(a => ({
                            href: a.getAttribute('href') || '',
                            label: (a.textContent || '').trim().slice(0,160),
                            explicit: !!a.closest('[data-tool],[data-product],[data-app],[data-tool-id],.tool-card,.app-card,.product-card')
                        }))""")
                    for item in candidates:
                        url = canonical(item["href"], origin)
                        if not url or urlsplit(url).path in HUB_PATHS:
                            continue
                        if is_product(url) or (item["explicit"] and path != "/"):
                            found.setdefault(url, {
                                "name": item["label"], "source": "playwright-browser", "declared_features": []
                            })
                        if len(found) >= MAX_URLS:
                            notes.append("Browser discovery capped at " + str(MAX_URLS))
                            break
                except Exception as exc:
                    notes.append("Browser hub " + path + " failed: " + str(exc)[:130])
            context.close()
        finally:
            browser.close()
    report = {
        "schemaVersion": "yorphives.hq-browser-routes.v1",
        "generatedAt": utcnow(),
        "origin": origin,
        "successfulHubs": successful_hubs,
        "notes": notes,
        "products": [{"url": url, **meta} for url, meta in sorted(found.items())]
    }
    if successful_hubs == 0:
        raise RuntimeError("Browser could not load any YorpHives hub: " + "; ".join(notes[:3]))
    staging = storage / ".browser-discovery.tmp"
    output = storage / "browser-discovery.json"
    staging.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    staging.chmod(0o600)
    staging.replace(output)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only Playwright observation of JS-rendered tool links")
    parser.add_argument("--base-url", choices=("https://yorphives.com", "https://www.yorphives.com"),
                        default="https://yorphives.com")
    parser.add_argument("--state-dir", default="~/.local/state/yorphives-hq")
    args = parser.parse_args()
    os.umask(0o077)
    try:
        storage = private_storage(args.state_dir)
        if not storage.is_dir() or storage.stat().st_mode & 0o077:
            raise ValueError("Initialize a private evidence directory with the HTTP discovery worker first")
        result = browser_discover(args.base_url, storage)
        print(json.dumps({"at": result["generatedAt"], "found": len(result["products"]), "hubs": result["successfulHubs"]}))
        return 0
    except (ValueError, OSError, RuntimeError) as exc:
        print("Browser discovery blocked: " + str(exc)[:300], file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
