#!/usr/bin/env python3
"""Low-cost, read-only product opportunity research from public RSS/Atom sources.

Signals are leads, NOT estimates of actual traffic, market demand, or revenue.
This never edits source trees, scrapes beyond configured feeds, or creates products.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit

from discover import SafeFetcher, connect_db, private_storage, trimmed, utcnow

DEFAULT_CONFIG = Path(__file__).with_name("research_sources.json")
RESEARCH_KEYWORDS = ("tool", "calculator", "image", "pdf", "seo", "workflow",
                     "website", "developer", "automation", "browser", "productivity",
                     "convert", "resume", "ai agent", "free app", "open source")
STOPWORDS = {"the", "and", "for", "with", "from", "this", "that", "online", "tool",
             "tools", "app", "apps", "new", "free", "open", "source", "show", "hn", "of", "a", "an"}


def text_of(element: ET.Element, names: set[str]) -> str:
    for child in element:
        if child.tag.rsplit("}", 1)[-1] in names and child.text:
            return re.sub(r"\s+", " ", child.text).strip()[:600]
    return ""


def feed_entries(body: bytes) -> list[dict]:
    root = ET.fromstring(body)
    entries = []
    for item in root.iter():
        if item.tag.rsplit("}", 1)[-1] not in ("item", "entry"):
            continue
        title = text_of(item, {"title"})
        link = text_of(item, {"link"})
        if not link:
            for child in item:
                if child.tag.rsplit("}", 1)[-1] == "link":
                    link = child.attrib.get("href", "")
                    if link:
                        break
        summary = text_of(item, {"description", "summary", "content"})
        date = text_of(item, {"pubDate", "published", "updated"})
        if title and link and urlsplit(link).scheme in ("https", "http"):
            entries.append({"title": title, "url": link, "summary": re.sub("<[^>]*>", "", summary)[:400], "published": date})
    return entries[:100]


def termset(s: str) -> set[str]:
    return {x for x in re.findall(r"[a-z0-9]{3,}", s.lower()) if x not in STOPWORDS}


def similar(title: str, products: list[str]) -> tuple[str, float]:
    target = termset(title)
    if not target:
        return "", 0.0
    matches = []
    for name in products:
        tokens = termset(name)
        if tokens:
            score = 2 * len(target & tokens) / (len(target) + len(tokens))
            matches.append((score, name))
    if not matches:
        return "", 0.0
    match, name = max(matches)
    return (name, round(match, 2)) if match >= 0.66 else ("", round(match, 2))


def source_score(title: str, summary: str, published: str, sources: int) -> tuple[int, list[str]]:
    signals = []
    score = 10  # A public source entry is one weak evidence signal, not demand proof.
    lower = (title + " " + summary).lower()
    matches = sorted(x for x in RESEARCH_KEYWORDS if x in lower)
    if matches:
        signals.append("Relevant topics: " + ", ".join(matches[:5]))
        score += min(12, len(matches) * 3)
    if sources > 1:
        score += 10
        signals.append("Mentioned in multiple configured feeds (not verified unique demand)")
    if published:
        try:
            dt = parsedate_to_datetime(published)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            days = (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).days
            if 0 <= days <= 14:
                score += 10
                signals.append("Published within 14 days")
        except (TypeError, ValueError, OverflowError):
            pass
    signals.append("No verified search volume, users, conversions, or willingness-to-pay data")
    return min(score, 45), signals


def run(storage: Path, config_path: Path) -> dict:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    feeds = config.get("feeds", [])
    if not isinstance(feeds, list) or len(feeds) > 20:
        raise ValueError("feeds must be a list of at most 20 URLs")
    now = utcnow()
    db = connect_db(storage)
    try:
        db.execute("""CREATE TABLE IF NOT EXISTS leads (
            url TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL,
            first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
            feed_count INTEGER NOT NULL DEFAULT 1, published TEXT NOT NULL DEFAULT ''
        )""")
        product_names = [row[0] for row in db.execute("SELECT name FROM products WHERE active=1")]
        observed: dict[str, dict] = {}
        notes = []
        successful_feeds = 0
        for raw in feeds:
            if not isinstance(raw, dict) or not isinstance(raw.get("url"), str):
                continue
            feed_url = raw["url"].strip()
            parsed = urlsplit(feed_url)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                notes.append("Skipped non-HTTPS or invalid feed URL")
                continue
            try:
                origin = parsed.scheme + "://" + parsed.netloc
                client = SafeFetcher(origin)
                status, data, _ = client.get(feed_url, preserve_query=True)
                if status != 200:
                    notes.append("Feed HTTP " + str(status) + ": " + parsed.hostname)
                    continue
                successful_feeds += 1
                for entry in feed_entries(data):
                    combined = (entry["title"] + " " + entry["summary"]).lower()
                    if not any(term in combined for term in RESEARCH_KEYWORDS):
                        continue
                    key = entry["url"]
                    if key in observed:
                        observed[key]["feeds"].add(trimmed(raw.get("id"), 60))
                    else:
                        observed[key] = {**entry, "feeds": {trimmed(raw.get("id"), 60)}}
            except (OSError, ValueError, ET.ParseError) as exc:
                notes.append("Feed failed: " + parsed.hostname + ": " + trimmed(exc, 120))
        # A failed feed run must not mark old leads invalid or fabricate discoveries.
        with db:
            for entry in observed.values():
                before = db.execute("SELECT first_seen FROM leads WHERE url=?", (entry["url"],)).fetchone()
                if before:
                    db.execute("UPDATE leads SET last_seen=?,feed_count=? WHERE url=?",
                               (now, len(entry["feeds"]), entry["url"]))
                else:
                    db.execute("""INSERT INTO leads(url,title,summary,first_seen,last_seen,feed_count,published)
                                  VALUES(?,?,?,?,?,?,?)""", (entry["url"], entry["title"], entry["summary"],
                                    now, now, len(entry["feeds"]), entry["published"]))
        output = []
        # Keep relevant past discoveries in a long-term memory, but label old
        # records plainly and never present cached signals as newly observed.
        historical = db.execute("""SELECT url,title,summary,first_seen,last_seen,feed_count,published
                                  FROM leads ORDER BY last_seen DESC LIMIT 200""").fetchall()
        for row in historical:
            recent = observed.get(row["url"])
            score, signals = source_score(row["title"], row["summary"], row["published"], row["feed_count"])
            existing, similarity = similar(row["title"], product_names)
            kind = "possible-existing-product" if existing else "potential-missing-product"
            if not recent:
                signals.append("Historical lead; not observed in the latest feed scan")
            output.append({
                "id": hashlib.sha256(row["url"].encode()).hexdigest()[:16],
                "title": row["title"][:160], "category": "product",
                "confidence": "Unvalidated research lead" if recent else "Historical lead — refresh required",
                "description": row["summary"] or "Public source mention; product value is unknown.",
                "recommendation": ("Compare this candidate's features against " + existing + " using source-backed evidence." if existing
                                   else "Validate audience need, alternatives, licensing, differentiation and potential organic traffic."),
                "evidence": [row["url"]], "observedAt": row["last_seen"],
                "firstSeen": row["first_seen"], "lastSeen": row["last_seen"],
                "kind": kind, "relatedProduct": existing, "similarity": similarity,
                "researchScore": score, "scoreMeaning": "research triage only; not search demand, traffic, or revenue",
                "signals": signals, "sourceFeeds": sorted(recent["feeds"]) if recent else []
            })
        output.sort(key=lambda lead: (-lead["researchScore"], lead["title"]))
        report = {
            "schemaVersion": "yorphives.hq-intelligence.v1", "generatedAt": now,
            "verification": {"method": "configured-public-rss-feeds", "successfulFeeds": successful_feeds,
                             "totalFeeds": len(feeds), "notes": notes,
                             "limitations": "RSS mentions are hypotheses, not validated consumer demand or competitor feature comparisons"},
            "opportunities": output[:80], "comparisons": []
        }
        path = storage / "growth-research-report.json"
        staging = storage / ".growth-research-report.tmp"
        staging.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        staging.chmod(0o600)
        staging.replace(path)
        return report
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only public-feed product opportunity radar")
    parser.add_argument("--state-dir", default="~/.local/state/yorphives-hq")
    parser.add_argument("--sources", default=str(DEFAULT_CONFIG))
    args = parser.parse_args()
    try:
        report = run(private_storage(args.state_dir), Path(args.sources))
        print(json.dumps({"at": report["generatedAt"], "leads": len(report["opportunities"]),
                          "feeds": report["verification"]["successfulFeeds"]}), flush=True)
        return 0 if report["verification"]["successfulFeeds"] else 2
    except (OSError, ValueError, sqlite3.Error, ET.ParseError) as exc:
        print("Research blocked: " + trimmed(exc, 300), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
