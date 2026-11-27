#!/usr/bin/env python3
"""Offline verification for the schema-only HQ reporting bootstrap migration."""
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parent.parent
MIGRATION = (ROOT / "migrations/0015_hq_reporting_schema.sql").read_text()

REPORT_QUERIES = [
    ("workflow_runs", "SELECT * FROM workflow_runs ORDER BY created_at DESC LIMIT 60", ()),
    ("nano_memories", "SELECT * FROM nano_memories ORDER BY recorded_at DESC LIMIT 60", ()),
    ("nano_playbooks join", "SELECT p.*,m.title FROM nano_playbooks p JOIN nano_memories m ON m.memory_id=p.memory_id ORDER BY p.reviewed_at DESC,p.rowid DESC LIMIT 60", ()),
    ("nano_triage", "SELECT * FROM nano_triage ORDER BY assessed_at DESC,memory_id DESC LIMIT 80", ()),
    ("nano_investigations", "SELECT * FROM nano_investigations ORDER BY checked_at DESC,memory_id DESC LIMIT 40", ()),
    ("nano_source_scans", "SELECT * FROM nano_source_scans ORDER BY checked_at DESC LIMIT 10", ()),
    ("nano_source_leads", "SELECT * FROM nano_source_leads ORDER BY observed_at DESC LIMIT 12", ()),
    ("nano_opportunity_briefs", "SELECT * FROM nano_opportunity_briefs ORDER BY priority DESC,updated_at DESC LIMIT 60", ()),
    ("nano_journal_scans", "SELECT * FROM nano_journal_scans ORDER BY checked_at DESC LIMIT 4", ()),
    ("nano_journal_papers", "SELECT * FROM nano_journal_papers ORDER BY last_seen DESC LIMIT 60", ()),
    ("nano_science_reviews", "SELECT * FROM nano_science_reviews ORDER BY research_priority DESC,updated_at DESC LIMIT 80", ()),
    ("nano_implementation_checks join", "SELECT c.*,p.title paper_title,p.source_url FROM nano_implementation_checks c JOIN nano_journal_papers p ON p.paper_id=c.paper_id ORDER BY c.checked_at DESC LIMIT 40", ()),
    ("nano_manifest_evidence", "SELECT * FROM nano_manifest_evidence ORDER BY checked_at DESC LIMIT 40", ()),
    ("nano_research_founder_reviews", "SELECT * FROM nano_research_founder_reviews ORDER BY reviewed_at DESC, version DESC LIMIT 80", ()),
    ("nano_experiment_gate_evidence", "SELECT * FROM nano_experiment_gate_evidence ORDER BY recorded_at DESC, revision DESC LIMIT 600", ()),
    ("incident_history", "SELECT * FROM incident_history ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, last_seen DESC LIMIT 80", ()),
    ("incident_events", "SELECT * FROM incident_events ORDER BY sequence DESC LIMIT 150", ()),
    ("assets", "SELECT * FROM assets ORDER BY kind ASC,name ASC LIMIT 150", ()),
    ("findings", "SELECT * FROM findings WHERE status='open' ORDER BY observed_at DESC LIMIT 80", ()),
    ("opportunities", "SELECT * FROM opportunities ORDER BY observed_at DESC LIMIT 50", ()),
    ("quota", "SELECT kind,used FROM quota WHERE day=? ", ("2026-11-27",)),
    ("status", "SELECT key,value,checked_at FROM status ORDER BY checked_at DESC LIMIT 30", ()),
    ("security_watch", "SELECT * FROM security_watch ORDER BY observed_at DESC LIMIT 15", ()),
    ("product_hypotheses", "SELECT * FROM product_hypotheses ORDER BY observed_at DESC LIMIT 30", ()),
    ("founder_decisions", "SELECT * FROM founder_decisions ORDER BY sequence DESC LIMIT 2000", ()),
]

with sqlite3.connect(":memory:") as db:
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
      CREATE TABLE opportunities(
        id TEXT PRIMARY KEY,title TEXT,description TEXT,recommendation TEXT,
        source_url TEXT,observed_at TEXT,score INTEGER,kind TEXT
      );
      CREATE TABLE quota(
        day TEXT NOT NULL,kind TEXT NOT NULL,used INTEGER NOT NULL CHECK(used>=0),
        PRIMARY KEY(day,kind)
      );
      CREATE TABLE status(key TEXT PRIMARY KEY,value TEXT NOT NULL,checked_at TEXT NOT NULL);
    """)
    db.execute(
        "INSERT INTO opportunities VALUES (?,?,?,?,?,?,?,?)",
        ("stage-fixture", "Synthetic staging record", "No production data",
         "Review only", "https://example.test/evidence", "2026-11-27T00:00:00Z",
         0, "unvalidated-lead"),
    )
    db.execute(
        "INSERT INTO quota(day,kind,used) VALUES (?,?,?)",
        ("2026-11-27", "hq_workers_ai_requests", 1),
    )
    db.execute(
        "INSERT INTO status(key,value,checked_at) VALUES (?,?,?)",
        ("last_cron", "synthetic-staging-fixture", "2026-11-27T00:00:00Z"),
    )

    db.executescript(MIGRATION)
    db.executescript(MIGRATION)  # All CREATE TABLE/INDEX statements must be idempotent.

    tables = {
        row[0] for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
    }
    required_tables = {
        "assets", "findings", "founder_decisions", "incident_events",
        "incident_history", "nano_experiment_gate_evidence",
        "nano_implementation_checks", "nano_investigations",
        "nano_journal_papers", "nano_journal_scans", "nano_manifest_evidence",
        "nano_memories", "nano_opportunity_briefs", "nano_playbooks",
        "nano_research_founder_reviews", "nano_science_reviews",
        "nano_source_leads", "nano_source_scans", "nano_triage",
        "product_hypotheses", "product_intel_leads", "product_intel_signals",
        "product_intel_sources", "security_watch", "workflow_runs",
    }
    assert required_tables <= tables, required_tables - tables

    expected_indexes = set(re.findall(
        r"CREATE INDEX IF NOT EXISTS\\s+([A-Za-z_][A-Za-z0-9_]*)", MIGRATION, re.I
    ))
    actual_indexes = {
        row[0] for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL"
        )
    }
    assert len(expected_indexes) == 36, len(expected_indexes)
    assert expected_indexes <= actual_indexes, expected_indexes - actual_indexes

    for name, sql, params in REPORT_QUERIES:
        try:
            db.execute(sql, params).fetchall()
        except sqlite3.Error as error:
            raise AssertionError(f"Report query failed ({name}): {error}") from error

    assert db.execute(
        "SELECT title FROM opportunities WHERE id='stage-fixture'"
    ).fetchone() == ("Synthetic staging record",)
    assert db.execute(
        "SELECT used FROM quota WHERE day='2026-11-27' AND kind='hq_workers_ai_requests'"
    ).fetchone() == (1,)
    assert db.execute(
        "SELECT value FROM status WHERE key='last_cron'"
    ).fetchone() == ("synthetic-staging-fixture",)
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []
    assert db.execute("PRAGMA integrity_check").fetchone() == ("ok",)

print("PASS HQ reporting schema: 25 tables, 36 indexes, 25 report queries, idempotence, data preservation and SQLite integrity")
