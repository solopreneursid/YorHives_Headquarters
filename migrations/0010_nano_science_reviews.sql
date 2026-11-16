-- Nano Phase 11: portable, additive scientific evidence review records.
-- These are deterministic analysis plans, not peer-reviewed reproduction or approvals.
CREATE TABLE IF NOT EXISTS nano_science_reviews (
 paper_id TEXT PRIMARY KEY REFERENCES nano_journal_papers(paper_id),
 category TEXT NOT NULL,
 stage TEXT NOT NULL CHECK(stage IN ('review-needed','watch')),
 research_priority INTEGER NOT NULL CHECK(research_priority BETWEEN 0 AND 60),
 input_fingerprint TEXT NOT NULL,
 review_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nano_science_reviews_priority
 ON nano_science_reviews(stage,research_priority DESC,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_science_reviews_updated
 ON nano_science_reviews(updated_at DESC);
