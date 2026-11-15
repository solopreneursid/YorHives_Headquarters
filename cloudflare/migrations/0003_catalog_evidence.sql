-- v3: evidence-grade product discovery, read-only monitoring and comparison hypotheses.
-- Safe for the isolated HQ D1 database only; no website or repository writes.
ALTER TABLE assets ADD COLUMN discovery_source TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE assets ADD COLUMN evidence_url TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN inventory_confidence TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE assets ADD COLUMN page_fingerprint TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN changed_at TEXT;
ALTER TABLE assets ADD COLUMN features_json TEXT NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_assets_confidence ON assets(kind,inventory_confidence);
CREATE TABLE IF NOT EXISTS product_hypotheses (
  id TEXT PRIMARY KEY,
  product_url TEXT NOT NULL,
  product_name TEXT NOT NULL,
  competing_title TEXT NOT NULL,
  competing_url TEXT NOT NULL,
  evidence_summary TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unverified',
  observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_hypotheses_recent ON product_hypotheses(observed_at);
