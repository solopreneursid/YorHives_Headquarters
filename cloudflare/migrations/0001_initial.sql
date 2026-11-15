-- Founder-owned D1 data. No website writes, deployment tokens or mutable admin endpoints.
-- Use on a NEW, dedicated database (never against production website data).
CREATE TABLE IF NOT EXISTS assets (
  url TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'tool',
  first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, last_checked TEXT,
  http_status INTEGER, failures INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'unverified'
);
CREATE INDEX IF NOT EXISTS idx_assets_checked ON assets(last_checked);
CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY, category TEXT NOT NULL, priority TEXT NOT NULL,
  asset TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
  recommendation TEXT NOT NULL, evidence TEXT NOT NULL,
  observed_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS idx_findings_seen ON findings(observed_at);
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  recommendation TEXT NOT NULL, source_url TEXT NOT NULL,
  observed_at TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'unvalidated-lead'
);
CREATE INDEX IF NOT EXISTS idx_opportunities_seen ON opportunities(observed_at);
CREATE TABLE IF NOT EXISTS quota (
  day TEXT NOT NULL, kind TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, kind)
);
CREATE TABLE IF NOT EXISTS status (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, checked_at TEXT NOT NULL
);
