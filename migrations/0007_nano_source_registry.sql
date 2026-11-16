-- Phase 7: small portable D1/SQLite public source registry and research leads.
-- Sources are allowlisted in code; the database stores observations, not permissions.
CREATE TABLE IF NOT EXISTS nano_source_scans (
 source_id TEXT PRIMARY KEY,
 state TEXT NOT NULL CHECK(state IN ('listing-recorded','unavailable')),
 detail TEXT NOT NULL,
 added INTEGER NOT NULL CHECK(added BETWEEN 0 AND 2),
 checked_at TEXT NOT NULL,
 next_check_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nano_source_leads (
 lead_id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 title TEXT NOT NULL,
 source_url TEXT NOT NULL,
 summary TEXT NOT NULL,
 signals_json TEXT NOT NULL DEFAULT '{}',
 evidence_state TEXT NOT NULL CHECK(evidence_state = 'listing-unverified'),
 observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nano_source_leads_recent ON nano_source_leads(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_source_leads_source ON nano_source_leads(source_id,observed_at DESC);
