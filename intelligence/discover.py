#!/usr/bin/env python3
"""YorpHives read-only product discovery and monitoring (Python standard library).

Fetches public GET endpoints from the configured YorpHives website only.
Automatically inventories tools and apps from sitemap, section pages and an
optional machine-readable product manifest. Never edits a website or repo.

All persistent data and reports are stored OUTSIDE the checkout, in a private
SQLite evidence directory. Intended to run unprivileged on the founder's server.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import sys
import time
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET

PRODUCT_PREFIXES = ("/tools/", "/tool/", "/free-tools/", "/apps/", "/app/", "/explore/", "/products/")
HUB_PATHS = ("/", "/free-tools", "/tools", "/explore", "/apps", "/products")
MANIFEST_PATHS = ("/.well-known/yorphives-products.json", "/products.json")
SITEMAP_PATHS = ("/sitemap.xml", "/sitemap_index.xml")
USER_AGENT = "YorpHivesHQ-ObservationBot/0.1 (+read-only; founder-owned assets)"
MAX_DOCUMENT_BYTES = 1_000_000
MAX_URLS = 150
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def trimmed(s: object, limit: int = 200) -> str:
    return str(s or "").strip()[:limit]


def normalize_space(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def digest(s: object) -> str:
    return hashlib.sha256(json.dumps(s, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def canonical(url: str, origin: str) -> str | None:
    """Accept only exact same hostname, port and scheme as configured origin."""
    try:
        absolute = urljoin(origin + "/", url)
        parsed, root = urlsplit(absolute), urlsplit(origin)
        if parsed.scheme != root.scheme or parsed.hostname != root.hostname or parsed.port != root.port:
            return None
        if parsed.username is not None or parsed.password is not None:
            return None
        # No query/fragment in route identity: query-driven pages are not products.
        clean_path = re.sub("/{2,}", "/", parsed.path or "/")
        if "/../" in clean_path or clean_path.endswith("/.."):
            return None
        clean_path = clean_path.rstrip("/") or "/"
        return urlunsplit((parsed.scheme, parsed.netloc, clean_path, "", ""))
    except ValueError:
        return None


def is_product(url: str) -> bool:
    path = urlsplit(url).path.lower()
    return any(path.startswith(prefix) and len(path) > len(prefix) for prefix in PRODUCT_PREFIXES)


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str, bool]] = []
        self.title = ""
        self.heading = ""
        self.controls: list[str] = []
        self._tag = ""
        self._link: tuple[str, bool] | None = None
        self._link_text: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag in ("script", "style", "noscript"):
            self._skip += 1
            return
        if self._skip:
            return
        if tag == "a":
            href = values.get("href") or ""
            flagged = any(key in values for key in ("data-tool", "data-app", "data-product", "data-tool-id"))
            self._link = (href, flagged)
            self._link_text = []
        elif tag in ("title", "h1", "button", "label"):
            self._tag = tag
        elif tag == "input":
            kind = (values.get("type") or "text").lower()
            label = values.get("aria-label") or values.get("placeholder") or kind
            if kind in ("file", "search", "number", "color", "range"):
                self.controls.append(trimmed(kind + ": " + label, 120))

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript") and self._skip:
            self._skip -= 1
            return
        if self._skip:
            return
        if tag == "a" and self._link is not None:
            href, flagged = self._link
            self.links.append((href, normalize_space(" ".join(self._link_text)), flagged))
            self._link = None
            self._link_text = []
        if tag == self._tag:
            self._tag = ""

    def handle_data(self, data: str) -> None:
        if self._skip:
            return
        word = normalize_space(data)
        if not word:
            return
        if self._link is not None:
            self._link_text.append(word)
        if self._tag == "title":
            self.title += (" " if self.title else "") + word
        elif self._tag == "h1" and not self.heading:
            self.heading = word
        elif self._tag in ("button", "label"):
            self.controls.append(trimmed(word, 120))

    @property
    def features(self) -> list[str]:
        # Controls are evidence of UI surface, not proof a feature works.
        return sorted(set(normalize_space(x).lower() for x in self.controls if x))[:50]


class DoNotRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class SafeFetcher:
    def __init__(self, origin: str, timeout: float = 9.0, allow_local: bool = False) -> None:
        parsed = urlsplit(origin)
        if not parsed.hostname or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
            raise ValueError("base-url must be an origin, e.g. https://yorphives.com")
        if parsed.scheme != "https" and not (allow_local and parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")):
            raise ValueError("Only HTTPS origins are allowed (except explicitly enabled local tests)")
        self.origin = origin.rstrip("/")
        self.timeout = timeout
        self.allow_local = allow_local
        self.opener = build_opener(DoNotRedirect())
        # Prevent accidental requests to private internal addresses from hosted workers.
        if not allow_local:
            for entry in socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM):
                ip = ipaddress.ip_address(entry[4][0])
                if not ip.is_global:
                    raise ValueError("Refusing private/non-public resolved address for " + parsed.hostname)

    def get(self, url: str, preserve_query: bool = False) -> tuple[int, bytes, str]:
        target = canonical(url, self.origin)
        if target is None:
            raise ValueError("Refused off-origin URL")
        if preserve_query:
            # RSS feeds can use query parameters; product identity intentionally cannot.
            target_parts, supplied = urlsplit(target), urlsplit(url)
            target = urlunsplit((target_parts.scheme, target_parts.netloc, target_parts.path, supplied.query, ""))
        visited = set()
        for _ in range(4):
            if target in visited:
                raise ValueError("Refusing redirect loop")
            visited.add(target)
            request = Request(target, headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xml,application/json;q=0.9,*/*;q=0.1"
            })
            try:
                with self.opener.open(request, timeout=self.timeout) as response:
                    body = response.read(MAX_DOCUMENT_BYTES + 1)
                    if len(body) > MAX_DOCUMENT_BYTES:
                        raise ValueError("Page exceeded 1 MB response limit")
                    return response.status, body, response.headers.get_content_type()
            except HTTPError as exc:
                if 300 <= exc.code < 400 and exc.headers.get("Location"):
                    destination = canonical(urljoin(target, exc.headers["Location"]), self.origin)
                    if destination is None:
                        return exc.code, b"", "Cross-origin redirect refused"
                    target = destination
                    continue
                return exc.code, b"", "HTTP " + str(exc.code)
        return 508, b"", "Too many redirects"


def decode_html(raw: bytes) -> PageParser:
    parser = PageParser()
    parser.feed(raw.decode("utf-8", errors="replace"))
    parser.close()
    return parser


def xml_urls(raw: bytes, origin: str) -> tuple[list[str], list[str]]:
    """Parse Sitemap XML and nested sitemap references without fetching them here."""
    links, maps = [], []
    root = ET.fromstring(raw)
    local_tag = root.tag.rsplit("}", 1)[-1]
    if local_tag not in ("urlset", "sitemapindex"):
        return [], []
    for elem in root.iter():
        if elem.tag.rsplit("}", 1)[-1] != "loc" or not elem.text:
            continue
        candidate = canonical(elem.text.strip(), origin)
        if not candidate:
            continue
        if local_tag == "sitemapindex":
            maps.append(candidate)
        elif is_product(candidate):
            links.append(candidate)
    return links, maps


def discover(fetcher: SafeFetcher, browser_file: Path | None = None) -> tuple[dict[str, dict], list[str], bool, bool]:
    """Discover sources; never claim complete inventory when all sources fail."""
    found: dict[str, dict] = {}
    notes: list[str] = []
    trusted_sources = 0
    inspected = 0
    sitemap_queue = [fetcher.origin + path for path in SITEMAP_PATHS]
    visited_sitemaps: set[str] = set()

    while sitemap_queue and len(visited_sitemaps) < 8:
        url = sitemap_queue.pop(0)
        if url in visited_sitemaps:
            continue
        visited_sitemaps.add(url)
        try:
            status, data, _ = fetcher.get(url)
            if status != 200:
                continue
            links, maps = xml_urls(data, fetcher.origin)
            trusted_sources += 1
            for route in links:
                found.setdefault(route, {"name": "", "source": "sitemap", "declared_features": []})
            sitemap_queue += [m for m in maps if m not in visited_sitemaps]
        except (ET.ParseError, URLError, OSError, ValueError) as exc:
            notes.append("Sitemap unavailable: " + trimmed(exc, 160))

    for path in MANIFEST_PATHS:
        try:
            status, data, _ = fetcher.get(fetcher.origin + path)
            if status != 200:
                continue
            manifest = json.loads(data)
            if isinstance(manifest, dict):
                manifest = manifest.get("products", [])
            if not isinstance(manifest, list):
                notes.append("Invalid product manifest shape")
                continue
            trusted_sources += 1
            for item in manifest[:MAX_URLS]:
                if not isinstance(item, dict):
                    continue
                route = canonical(str(item.get("url", "")), fetcher.origin)
                if not route or route == fetcher.origin + "/":
                    continue
                features = item.get("features", [])
                if not isinstance(features, list):
                    features = []
                found[route] = {
                    "name": trimmed(item.get("name") or item.get("title"), 160),
                    "source": "manifest",
                    "declared_features": [trimmed(f, 120).lower() for f in features[:40] if isinstance(f, str)]
                }
        except (URLError, OSError, ValueError, json.JSONDecodeError) as exc:
            notes.append("Manifest unavailable: " + trimmed(exc, 160))

    for path in HUB_PATHS:
        try:
            status, data, kind = fetcher.get(fetcher.origin + path)
            if status != 200 or "html" not in kind:
                continue
            trusted_sources += 1
            page = decode_html(data)
            for href, text, explicit in page.links[:500]:
                url = canonical(href, fetcher.origin)
                if not url or urlsplit(url).path in HUB_PATHS:
                    continue
                if is_product(url) or (explicit and path != "/"):
                    found.setdefault(url, {"name": trimmed(text, 160), "source": "hub", "declared_features": []})
                if len(found) >= MAX_URLS:
                    notes.append("Product inventory capped at " + str(MAX_URLS) + " URLs")
                    break
        except (URLError, OSError, ValueError) as exc:
            notes.append("Hub unavailable (" + path + "): " + trimmed(exc, 160))
    browser_complete = False
    if browser_file and browser_file.is_file():
        try:
            browser_report = json.loads(browser_file.read_text(encoding="utf-8"))
            saved = datetime.fromisoformat(str(browser_report["generatedAt"]).replace("Z", "+00:00"))
            age = (datetime.now(timezone.utc) - saved).total_seconds()
            if browser_report.get("origin") == fetcher.origin and 0 <= age < 12 * 3600:
                browser_complete = browser_report.get("successfulHubs", 0) > 0
                for item in browser_report.get("products", [])[:MAX_URLS]:
                    if not isinstance(item, dict):
                        continue
                    url = canonical(str(item.get("url", "")), fetcher.origin)
                    if not url or url == fetcher.origin + "/":
                        continue
                    found.setdefault(url, {"name": trimmed(item.get("name"), 160),
                                           "source": "playwright-browser", "declared_features": []})
            else:
                notes.append("Browser evidence stale or from a different origin; not used")
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
            notes.append("Browser evidence unreadable; not used")
    inspected = len(found)
    truncated = inspected >= MAX_URLS
    if truncated:
        notes.append("Inventory limit reached; absence-based removals suppressed")
    if inspected == 0:
        notes.append("No products discovered; no removal decisions will be made")
    # Preserve old inventory if discovery sources fail or website has no discoverable tools.
    complete = trusted_sources > 0 and inspected > 0 and not truncated
    return dict(sorted(found.items())[:MAX_URLS]), notes, complete, browser_complete


def connect_db(storage: Path) -> sqlite3.Connection:
    if storage.exists():
        # Refuse a pre-existing world-readable evidence location rather than
        # silently changing permissions on an arbitrary caller-owned directory.
        if storage.stat().st_mode & 0o077:
            raise ValueError("Evidence directory must be private (0700): " + str(storage))
    else:
        storage.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(storage / "product-intelligence.sqlite3")
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
      CREATE TABLE IF NOT EXISTS products (
        url TEXT PRIMARY KEY, name TEXT NOT NULL, source TEXT NOT NULL,
        first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
        current_status TEXT NOT NULL DEFAULT 'unknown', http_status INTEGER,
        health_fail_streak INTEGER NOT NULL DEFAULT 0,
        missing_streak INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
        content_hash TEXT NOT NULL DEFAULT '', feature_hash TEXT NOT NULL DEFAULT '',
        features_json TEXT NOT NULL DEFAULT '[]', last_checked TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        occurred_at TEXT NOT NULL, url TEXT NOT NULL, kind TEXT NOT NULL,
        severity TEXT NOT NULL, summary TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT, completed_at TEXT NOT NULL,
        complete INTEGER NOT NULL, discovered INTEGER NOT NULL, notes_json TEXT NOT NULL
      );
    """)
    return db


def note_event(db: sqlite3.Connection, now: str, url: str, kind: str, severity: str, summary: str) -> None:
    db.execute("INSERT INTO changes(occurred_at,url,kind,severity,summary) VALUES(?,?,?,?,?)",
               (now, url, kind, severity, summary))


def check_and_update(db: sqlite3.Connection, fetcher: SafeFetcher, discovered: dict[str, dict], now: str, complete: bool, browser_complete: bool = False) -> tuple[int, int]:
    previous_good = db.execute("SELECT COUNT(*) FROM scans WHERE complete=1").fetchone()[0] > 0
    onboarded = 0
    changes = 0
    for url, hint in discovered.items():
        before = db.execute("SELECT * FROM products WHERE url=?", (url,)).fetchone()
        status = 0
        name = hint["name"] or (before["name"] if before else urlsplit(url).path.rsplit("/", 1)[-1].replace("-", " ").title())
        features = sorted(set(hint["declared_features"]))
        content_hash = ""
        try:
            status, data, kind = fetcher.get(url)
            if status == 200 and "html" in kind:
                page = decode_html(data)
                name = trimmed(page.heading or page.title or name, 160)
                features = sorted(set(features + page.features))[:60]
                # Only stable visible UI surface; do not hash volatile page-wide counters or scripts.
                content_hash = digest({"heading": page.heading, "title": page.title, "controls": features})
        except (URLError, OSError, ValueError, TimeoutError) as exc:
            status = 0
            # Connection failures are observations, not proof the page was removed.
        state = "healthy" if 200 <= status < 300 else "degraded"
        fail_count = 0 if state == "healthy" else (int(before["health_fail_streak"]) + 1 if before else 1)
        feature_hash = digest(features) if features else ""
        if before is None:
            db.execute("""INSERT INTO products(url,name,source,first_seen,last_seen,current_status,http_status,
                          health_fail_streak,features_json,content_hash,feature_hash,last_checked)
                          VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                       (url, name, hint["source"], now, now, state, status, fail_count,
                        json.dumps(features), content_hash, feature_hash, now))
            onboarded += 1
            if previous_good:
                note_event(db, now, url, "new-product", "info",
                           "New tool or app discovered and automatically enrolled in monitoring: " + name)
                changes += 1
        else:
            old_features = before["feature_hash"]
            if before["active"] == 0 and complete:
                note_event(db, now, url, "restored-product", "info", "Previously missing product is discoverable again")
                changes += 1
            if old_features and feature_hash and old_features != feature_hash and state == "healthy":
                note_event(db, now, url, "feature-surface-change", "info",
                           "Visible controls changed; review to determine whether functionality improved or regressed")
                changes += 1
            elif before["content_hash"] and content_hash and before["content_hash"] != content_hash and state == "healthy":
                note_event(db, now, url, "product-content-change", "info", "Page title or controls changed")
                changes += 1
            if fail_count == 2:
                note_event(db, now, url, "repeated-health-failure", "high",
                           "Product failed two consecutive HTTP checks; investigate availability")
                changes += 1
            if state == "healthy" and before["health_fail_streak"] >= 2:
                note_event(db, now, url, "health-recovered", "info", "Product responded successfully after repeated failures")
                changes += 1
            db.execute("""UPDATE products SET name=?, source=?, last_seen=?, current_status=?, http_status=?,
                          health_fail_streak=?, missing_streak=0, active=1, features_json=?, feature_hash=?,
                          content_hash=?, last_checked=? WHERE url=?""",
                       (name, hint["source"], now, state, status, fail_count, json.dumps(features),
                        feature_hash, content_hash, now, url))
    # An incomplete discovery must break the sequence of confirmed absences.
    # Otherwise two partial discoveries could falsely claim an existing tool vanished.
    if not complete:
        db.execute("UPDATE products SET missing_streak=0 WHERE active=1")
    # Two consecutive COMPLETE discovery runs must omit an asset before marking missing.
    # A temporary sitemap or homepage outage must never generate mass removals.
    if complete:
        for row in db.execute("SELECT url,missing_streak,active,source FROM products").fetchall():
            if row["url"] in discovered:
                continue
            if row["source"] == "playwright-browser" and not browser_complete:
                db.execute("UPDATE products SET missing_streak=0 WHERE url=?", (row["url"],))
                continue
            absent = row["missing_streak"] + 1
            if row["active"] and absent == 2:
                note_event(db, now, row["url"], "product-no-longer-discoverable", "medium",
                           "Tool absent from two consecutive successful discoveries; verify before treating as removed")
                changes += 1
            db.execute("UPDATE products SET missing_streak=?, active=? WHERE url=?",
                       (absent, 0 if absent >= 2 else row["active"], row["url"]))
    return onboarded, changes


def build_report(db: sqlite3.Connection, now: str, complete: bool, notes: list[str], count: int) -> dict:
    rows = db.execute("SELECT * FROM products ORDER BY active DESC, name ASC").fetchall()
    recent = db.execute("SELECT * FROM changes ORDER BY id DESC LIMIT 80").fetchall()
    products = []
    for row in rows:
        products.append({
            "id": digest(row["url"])[:14], "name": row["name"], "url": row["url"],
            "source": row["source"], "status": row["current_status"] if row["active"] else "not_discoverable",
            "httpStatus": row["http_status"], "firstSeen": row["first_seen"], "lastSeen": row["last_seen"],
            "lastChecked": row["last_checked"], "features": json.loads(row["features_json"]),
            "active": bool(row["active"]), "healthFailStreak": row["health_fail_streak"],
            "missingStreak": row["missing_streak"]
        })
    changes = [{
        "id": str(row["id"]), "occurredAt": row["occurred_at"],
        "url": row["url"], "kind": row["kind"], "severity": row["severity"], "summary": row["summary"]
    } for row in recent]
    observations = [event for event in changes if event["kind"] in ("repeated-health-failure", "product-no-longer-discoverable")]
    return {
        "schemaVersion": "yorphives.hq-intelligence.v1",
        "generatedAt": now,
        "verification": {"method": "read-only-same-origin-http", "complete": complete, "discovered": count,
                         "limitations": "HTTP and visible HTML controls only; no JavaScript execution, business feature proof, or competitor benchmarking",
                         "notes": notes},
        "assets": [{"id": p["id"], "name": p["name"], "kind": "Discovered tool", "status": "healthy" if p["status"] == "healthy" else "unknown",
                    "summary": p["url"]} for p in products],
        "products": products, "changes": changes,
        "findings": [{"id": e["id"], "title": e["summary"], "category": "reliability", "priority": "high" if e["severity"] == "high" else "medium",
                      "asset": e["url"], "description": e["summary"],
                      "recommendation": "Inspect the page and confirm independently; do not modify production automatically.",
                      "observedAt": e["occurredAt"], "evidence": [e["url"]]} for e in observations],
        "opportunities": [], "comparisons": [], "agents": [],
        "activity": [{"id": e["id"], "title": e["kind"].replace("-", " ").title(),
                      "summary": e["summary"], "kind": "discovery", "occurredAt": e["occurredAt"]} for e in changes]
    }


def private_storage(path: str) -> Path:
    location = Path(path).expanduser().resolve()
    if location == PROJECT_ROOT or PROJECT_ROOT in location.parents:
        raise ValueError("Refusing to write evidence inside project directory: " + str(location))
    for ancestor in (location, *location.parents):
        if (ancestor / ".git").exists():
            raise ValueError("Refusing to write evidence inside a Git worktree: " + str(location))
    return location


def scan(base_url: str, state_dir: Path, allow_local: bool = False, fetcher: SafeFetcher | None = None) -> dict:
    now = utcnow()
    db = connect_db(state_dir)
    try:
        source = fetcher or SafeFetcher(base_url, allow_local=allow_local)
        discovered, notes, complete, browser_complete = discover(source, state_dir / "browser-discovery.json")
        with db:
            onboarded, change_count = check_and_update(db, source, discovered, now, complete, browser_complete)
            db.execute("INSERT INTO scans(completed_at,complete,discovered,notes_json) VALUES(?,?,?,?)",
                       (now, int(complete), len(discovered), json.dumps(notes)))
        report = build_report(db, now, complete, notes, len(discovered))
        report["verification"]["browserDiscoveryAvailable"] = browser_complete
        report["verification"]["newlyEnrolled"] = onboarded
        report["verification"]["newEvents"] = change_count
        # Atomic report write; destination must remain outside the product repository.
        output = state_dir / "product-intelligence-report.json"
        staging = state_dir / ".product-intelligence-report.tmp"
        with staging.open("w", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.chmod(staging, 0o600)
        os.replace(staging, output)
        return report
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Automatically discover and monitor YorpHives tools without write access")
    parser.add_argument("--base-url", default="https://yorphives.com")
    parser.add_argument("--state-dir", default="~/.local/state/yorphives-hq")
    parser.add_argument("--loop", action="store_true", help="Continue read-only scans on a fixed interval")
    parser.add_argument("--interval-minutes", type=int, default=60)
    parser.add_argument("--allow-local", action="store_true", help="Permit localhost HTTP only for controlled tests")
    args = parser.parse_args()
    if args.interval_minutes < 15:
        parser.error("minimum interval is 15 minutes")
    os.umask(0o077)
    try:
        storage = private_storage(args.state_dir)
        while True:
            try:
                report = scan(args.base_url, storage, allow_local=args.allow_local)
                meta = report["verification"]
                print(json.dumps({"at": report["generatedAt"], "complete": meta["complete"],
                                  "discovered": meta["discovered"], "enrolled": meta["newlyEnrolled"],
                                  "events": meta["newEvents"], "stateDir": str(storage)}), flush=True)
            except (OSError, ValueError, URLError, sqlite3.Error) as exc:
                print("Discovery blocked: " + trimmed(exc, 300), file=sys.stderr, flush=True)
                if not args.loop:
                    return 2
            if not args.loop:
                break
            time.sleep(args.interval_minutes * 60)
    except KeyboardInterrupt:
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
