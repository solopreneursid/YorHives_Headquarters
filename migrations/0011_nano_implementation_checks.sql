-- Phase 12: read-only evidence of arXiv paper-page links and first-party GitHub metadata.
-- This table does NOT verify code authorship, legal license compliance or reproducibility.
CREATE TABLE IF NOT EXISTS nano_implementation_checks (
 paper_id TEXT PRIMARY KEY REFERENCES nano_journal_papers(paper_id),
 state TEXT NOT NULL CHECK (state IN (
  'page-unavailable','no-repository-link-observed','repository-link-observed',
  'repository-metadata-checked','repository-unavailable')),
 repository_url TEXT,
 license_spdx TEXT,
 facts_json TEXT NOT NULL DEFAULT '{}',
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 20),
 checked_at TEXT NOT NULL,
 next_check_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nano_implementation_checks_due
 ON nano_implementation_checks(next_check_at,checked_at);
CREATE INDEX IF NOT EXISTS idx_nano_implementation_checks_state
 ON nano_implementation_checks(state,checked_at DESC);
