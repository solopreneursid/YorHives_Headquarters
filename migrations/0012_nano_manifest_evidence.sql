-- Phase 14: bounded, read-only GitHub root-manifest and license-file provenance.
-- Content is NOT stored, executed or installed. Metadata is NOT a legal clearance.
CREATE TABLE IF NOT EXISTS nano_manifest_evidence (
 paper_id TEXT PRIMARY KEY REFERENCES nano_journal_papers(paper_id),
 repository_url TEXT NOT NULL,
 state TEXT NOT NULL CHECK (state IN (
  'catalogued','partial','complete','no-known-root-files','unavailable')),
 catalog_json TEXT NOT NULL DEFAULT '[]',
 evidence_json TEXT NOT NULL DEFAULT '[]',
 attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 50),
 checked_at TEXT NOT NULL,
 next_check_at TEXT NOT NULL,
 error_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_nano_manifest_evidence_due
 ON nano_manifest_evidence(next_check_at, checked_at);
CREATE INDEX IF NOT EXISTS idx_nano_manifest_evidence_state
 ON nano_manifest_evidence(state, checked_at DESC);
