-- Read-only public advisory references. These are NOT claims of actual vulnerabilities
-- in any YorpHives application until an exact dependency/version inventory is verified.
CREATE TABLE IF NOT EXISTS security_watch (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  packages TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  applicability TEXT NOT NULL DEFAULT 'unverified'
);
CREATE INDEX IF NOT EXISTS idx_security_watch_seen ON security_watch(observed_at);
