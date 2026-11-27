#!/usr/bin/env python3
"""Offline D1-compatible SQLite migration and integrity smoke test."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parent.parent
SQL = (ROOT / "migrations/growth/0001_growth_intelligence.sql").read_text()
with sqlite3.connect(":memory:") as db:
    db.executescript(SQL)
    db.executescript(SQL)  # idempotent
    names = {
        row[0] for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
    }
    required = {
        "growth_projects", "growth_audiences", "growth_sources",
        "growth_opportunities", "growth_reviews", "growth_drafts",
        "growth_outcomes",
    }
    assert required <= names, required - names
    assert db.execute("PRAGMA foreign_keys").fetchone() == (1,)
    db.execute("INSERT INTO growth_projects(id,name) VALUES (?,?)", ("taxpulse", "TaxPulse"))
    db.execute(
        "INSERT INTO growth_sources(id,source_url,source_type,observed_at) VALUES (?,?,?,?)",
        ("s1", "https://news.ycombinator.com/item?id=123", "public-discussion", "2026-11-27T06:00:00Z"),
    )
    db.execute(
        """INSERT INTO growth_opportunities
           (id,project_id,source_id,title,summary,relevance_score,
            audience_hypothesis,discovered_at)
           VALUES (?,?,?,?,?,?,?,?)""",
        ("g1", "taxpulse", "s1", "Tax calculator research",
         "Public discussion, not independently verified demand.", 62,
         "Taxpayers", "2026-11-27T06:00:00Z"),
    )
    assert db.execute(
        "SELECT approval_status FROM growth_opportunities WHERE id='g1'"
    ).fetchone() == ("unreviewed",)
    assert db.execute(
        "SELECT COUNT(*) FROM growth_outcomes"
    ).fetchone() == (0,)
    for query, params in [
        ("INSERT INTO growth_projects(id,name) VALUES (?,?)", ("taxpulse", "Duplicate")),
        ("INSERT INTO growth_audiences(id,project_id,label) VALUES (?,?,?)",
         ("orphan", "missing", "Invalid")),
        ("UPDATE growth_opportunities SET relevance_score=101 WHERE id=?", ("g1",)),
        ("INSERT INTO growth_outcomes(id,project_id,period_start,period_end,"
         "source_label,source_type,verified_revenue_minor) VALUES (?,?,?,?,?,?,?)",
         ("o1", "taxpulse", "2026-11-01", "2026-11-27",
          "Unverified source", "founder-attested", 100)),
    ]:
        try:
            db.execute(query, params)
        except sqlite3.IntegrityError:
            continue
        raise AssertionError("Expected schema constraint: " + query)
print("PASS growth schema: idempotent, relational integrity, bounds and unknown revenue")
