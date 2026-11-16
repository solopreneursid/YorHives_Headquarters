-- Phase 16: founder-created, append-only research evaluation history.
-- These are planning notes, never license clearance or permission for agents
-- to run code, spend money, contact parties, modify repositories, or deploy.
CREATE TABLE IF NOT EXISTS nano_research_founder_reviews (
 entry_id TEXT PRIMARY KEY,
 paper_id TEXT NOT NULL REFERENCES nano_journal_papers(paper_id),
 repository_url TEXT NOT NULL,
 manifest_sha TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 25),
 disposition TEXT NOT NULL CHECK(disposition IN (
  'needs-evidence','manual-shortlist','defer','plan-isolated-test')),
 license_concern TEXT NOT NULL CHECK(license_concern IN (
  'unreviewed','manual-legal-review','blocker-observed')),
 technical_concern TEXT NOT NULL CHECK(technical_concern IN (
  'unknown','needs-validation','blocked')),
 max_budget_inr INTEGER NOT NULL CHECK(max_budget_inr BETWEEN 0 AND 5000),
 max_runtime_minutes INTEGER NOT NULL CHECK(max_runtime_minutes BETWEEN 0 AND 120),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 16 AND 350),
 next_step TEXT NOT NULL CHECK(length(next_step) BETWEEN 16 AND 350),
 reviewed_at TEXT NOT NULL,
 UNIQUE(paper_id, version)
);
CREATE INDEX IF NOT EXISTS idx_nano_research_founder_reviews_recent
 ON nano_research_founder_reviews(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_research_founder_reviews_paper
 ON nano_research_founder_reviews(paper_id, version DESC);
