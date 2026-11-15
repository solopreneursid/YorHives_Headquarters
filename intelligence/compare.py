#!/usr/bin/env python3
"""Read-only competitor feature-surface comparison.

Scans ONLY competitor URLs explicitly selected by the owner, respecting
robots.txt, and returns cautious hypotheses with primary source links.
It never asserts that a feature works merely because landing-page text mentions
it, or that an absent keyword proves YorpHives lacks a feature.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sqlite3
import sys
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from discover import SafeFetcher, connect_db, private_storage, canonical, utcnow, trimmed
from research import DEFAULT_CONFIG, termset


class VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.segments = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "svg", "iframe"):
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg", "iframe") and self._skip > 0:
            self._skip -= 1

    def handle_data(self, text):
        if not self._skip and text.strip():
            self.segments.append(re.sub(r"\s+", " ", text.strip()))

    @property
    def text(self):
        return " ".join(self.segments)[:200_000].lower()


def robots_allows(fetcher: SafeFetcher, url: str) -> tuple[bool, str]:
    root = fetcher.origin + "/robots.txt"
    try:
        code, raw, _ = fetcher.get(root)
        if code in (401, 403):
            return False, "robots.txt access denied"
        if code in (404, 410):
            return True, "robots.txt not published; respect site terms separately"
        if code != 200:
            return False, "robots.txt cannot be verified (HTTP " + str(code) + "); fail closed"
        parser = RobotFileParser()
        parser.parse(raw.decode("utf-8", errors="replace").splitlines())
        return parser.can_fetch("YorpHivesHQ-ObservationBot", url), "robots.txt checked"
    except (OSError, ValueError):
        return False, "Could not verify robots.txt; fail closed"


def try_fetch_visible(url: str) -> tuple[str | None, str]:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return None, "Invalid or non-HTTPS URL"
    origin = parsed.scheme + "://" + parsed.netloc
    try:
        fetcher = SafeFetcher(origin)
        allowed, note = robots_allows(fetcher, url)
        if not allowed:
            return None, note
        code, body, kind = fetcher.get(url)
        if code != 200 or "html" not in kind:
            return None, "Site returned HTTP " + str(code)
        parser = VisibleText()
        parser.feed(body.decode("utf-8", errors="replace"))
        return parser.text, note
    except (OSError, ValueError) as exc:
        return None, str(exc)[:150]


def compare(state: Path, sources: Path) -> dict:
    config = json.loads(sources.read_text(encoding="utf-8"))
    watch = config.get("competitorWatchlist", [])
    if not isinstance(watch, list) or len(watch) > 20:
        raise ValueError("competitorWatchlist must be an array of at most 20 declared competitor pages")
    db = connect_db(state)
    try:
        products = db.execute("SELECT url,name,features_json,active FROM products WHERE active=1").fetchall()
        comparisons = []
        notes = []
        checked = 0
        for entry in watch:
            if not isinstance(entry, dict):
                continue
            url = trimmed(entry.get("url"), 600)
            name = trimmed(entry.get("name"), 150) or urlsplit(url).hostname or "Competitor"
            own = trimmed(entry.get("ourProductUrl"), 500)
            declared = entry.get("featureSignals", [])
            if not isinstance(declared, list):
                continue
            terms = [trimmed(x, 75).lower() for x in declared[:30] if isinstance(x, str) and len(x.strip()) >= 3]
            own_product = next((p for p in products if p["url"] == own), None)
            if not own_product:
                notes.append("No matching enrolled product for " + name + "; comparison skipped")
                continue
            foreign_text, external_note = try_fetch_visible(url)
            if foreign_text is None:
                notes.append(name + ": " + external_note)
                continue
            own_text, own_note = try_fetch_visible(own)
            if own_text is None:
                notes.append("Own product unavailable for comparison: " + own_note)
                continue
            checked += 1
            missing = [term for term in terms if term in foreign_text and term not in own_text]
            if missing:
                comparisons.append({
                    "id": "gap-" + str(checked), "product": own_product["name"], "competitor": name,
                    "missingFeatures": missing,
                    "confidence": "Unverified visible-text hypothesis",
                    "recommendation": "Manually compare the features in working browsers and validate user demand before suggesting a product change.",
                    "evidence": [own, url], "observedAt": utcnow(),
                    "limitations": "Mentions are not tested capabilities; absent words are not proof of absent features"
                })
        report = {
            "schemaVersion": "yorphives.hq-intelligence.v1", "generatedAt": utcnow(),
            "verification": {"method": "allowlisted-read-only-competitor-pages", "checked": checked,
                             "watchlistSize": len(watch), "notes": notes,
                             "limitations": "Text-only feature hypotheses; manual feature validation required"},
            "comparisons": comparisons
        }
        output = state / "competitive-report.json"
        staging = state / ".competitive-report.tmp"
        staging.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        staging.chmod(0o600)
        staging.replace(output)
        return report
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Cautious allowlisted competitor feature monitoring")
    parser.add_argument("--state-dir", default="~/.local/state/yorphives-hq")
    parser.add_argument("--sources", default=str(DEFAULT_CONFIG))
    args = parser.parse_args()
    try:
        result = compare(private_storage(args.state_dir), Path(args.sources))
        print(json.dumps({"checked": result["verification"]["checked"], "potentialGaps": len(result["comparisons"])}))
        return 0
    except (ValueError, OSError, sqlite3.Error) as exc:
        print("Comparison blocked: " + trimmed(exc, 300), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
