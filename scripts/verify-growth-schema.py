#!/usr/bin/env python3
"""Offline D1-compatible SQLite migration and integrity smoke test."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parent.parent
SQL = (ROOT / "migrations/growth/0001_growth_intelligence.sql").read_text()
REVIEW_SQL = (ROOT / "migrations/growth/0002_founder_review_journal.sql").read_text()
OUTCOME_SQL = (ROOT / "migrations/growth/0003_founder_outcomes.sql").read_text()
with sqlite3.connect(":memory:") as db:
    db.executescript(SQL)
    db.executescript(SQL)  # idempotent
    db.executescript(REVIEW_SQL)
    db.executescript(REVIEW_SQL)
    db.executescript(OUTCOME_SQL)
    db.executescript(OUTCOME_SQL)
    names = {
        row[0] for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
    }
    required = {
        "growth_projects", "growth_audiences", "growth_sources",
        "growth_opportunities", "growth_reviews", "growth_drafts",
        "growth_outcomes", "growth_intent_events",
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
    db.execute(
        """INSERT INTO growth_outcomes
           (id,project_id,period_start,period_end,source_label,source_type,
            verified_revenue_minor,currency)
           VALUES (?,?,?,?,?,?,?,?)""",
        ("ledger1", "taxpulse", "2026-11-01", "2026-11-27", "Verified ledger",
         "verified-payout-ledger", 100, "INR"),
    )
    assert db.execute(
        "SELECT verified_revenue_minor FROM growth_outcomes WHERE id='ledger1'"
    ).fetchone() == (100,)
    review_sql = """
      INSERT INTO growth_reviews(opportunity_id,from_status,to_status,review_note,reviewed_at,reviewed_by)
      SELECT o.id,o.approval_status,?,?,?,'founder' FROM growth_opportunities o
      WHERE o.id=? AND o.approval_status=? AND
      COALESCE((SELECT MAX(id) FROM growth_reviews WHERE opportunity_id=o.id),0)=?
    """
    def review(to_status, from_status, revision):
        return db.execute(review_sql, (to_status,"Founder-reviewed synthetic evidence",
                          "2026-11-27T07:00:00Z","g1",from_status,revision)).rowcount
    try:
        review("founder-executed","unreviewed",0)
        raise AssertionError("Execution bypassed approval")
    except sqlite3.IntegrityError:
        pass
    assert review("approved-for-founder","unreviewed",0) == 1
    assert db.execute("SELECT approval_status FROM growth_opportunities WHERE id='g1'").fetchone() == ("approved-for-founder",)
    assert review("rejected","unreviewed",0) == 0
    revision = db.execute("SELECT MAX(id) FROM growth_reviews WHERE opportunity_id='g1'").fetchone()[0]
    assert review("founder-executed","approved-for-founder",revision) == 1
    assert review("rejected","approved-for-founder",revision) == 0
    assert db.execute("SELECT COUNT(*) FROM growth_reviews").fetchone() == (2,)
    for sql in ["UPDATE growth_reviews SET review_note='changed'","DELETE FROM growth_reviews"]:
        try:
            db.execute(sql)
            raise AssertionError("Append-only review journal bypassed")
        except sqlite3.IntegrityError:
            pass
    assert db.execute("SELECT approval_status FROM growth_opportunities WHERE id='g1'").fetchone() == ("founder-executed",)
    db.execute("INSERT INTO growth_intent_events(opportunity_id,event_key,outcome,occurred_at,recorded_at) VALUES (?,?,?,?,?)",
               ("g1","11111111-1111-4111-8111-111111111111","requested-demo","2026-11-27T07:00:00Z","2026-11-27T07:00:00Z"))
    assert db.execute("SELECT source_type FROM growth_intent_events").fetchone() == ("founder-attested",)
    for q in ["UPDATE growth_intent_events SET outcome='declined'", "DELETE FROM growth_intent_events"]:
        try:
            db.execute(q)
            raise AssertionError("Intent journal modified")
        except sqlite3.IntegrityError:
            pass
print("PASS growth schema: idempotent, relational integrity, revenue provenance, review revision and append-only projection")
