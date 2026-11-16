-- YorpHivesHQ fresh database, independent of the legacy HQ.
CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  source_date TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opportunities_seen ON opportunities(last_seen DESC);
CREATE TABLE IF NOT EXISTS saved (
  opportunity_id TEXT PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
  opportunity_id TEXT PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('approve','reject','snooze')),
  updated_at TEXT NOT NULL
);