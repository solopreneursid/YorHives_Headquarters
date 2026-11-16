-- Phase 10: separate, zero-cost scientific source ingestion. SQLite/D1 portable.
-- Academic metadata is not peer-review, reproducibility, license or commercial proof.
CREATE TABLE IF NOT EXISTS nano_journal_scans (
 source_id TEXT PRIMARY KEY CHECK(source_id IN ('crossref','arxiv')),
 state TEXT NOT NULL CHECK(state IN ('ok','unavailable','rate-limited')),
 detail TEXT NOT NULL,
 topic_id TEXT NOT NULL,
 added INTEGER NOT NULL CHECK(added BETWEEN 0 AND 5),
 checked_at TEXT NOT NULL,
 next_check_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nano_journal_papers (
 paper_id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL CHECK(source_id IN ('crossref','arxiv')),
 topic_id TEXT NOT NULL,
 title TEXT NOT NULL,
 source_url TEXT NOT NULL UNIQUE,
 source_type TEXT NOT NULL,
 abstract_text TEXT NOT NULL DEFAULT '',
 published_at TEXT NOT NULL DEFAULT '',
 citation_count INTEGER,
 assessment_json TEXT NOT NULL,
 first_seen TEXT NOT NULL,
 last_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nano_journal_papers_recent ON nano_journal_papers(published_at DESC,last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_nano_journal_papers_topic ON nano_journal_papers(topic_id,published_at DESC);
