-- YorpHivesHQ Native v2 — independent D1 database, repeatable migrations.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL,
  category TEXT NOT NULL, source TEXT NOT NULL, url TEXT NOT NULL,
  source_date TEXT, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opportunities_seen ON opportunities(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category,last_seen DESC);
CREATE TABLE IF NOT EXISTS saved (
  opportunity_id TEXT PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
  opportunity_id TEXT PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('approve','reject','snooze')),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decision_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('approve','reject','snooze')),
  recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evaluations (
  opportunity_id TEXT PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
  model TEXT NOT NULL, reason TEXT NOT NULL, risk TEXT NOT NULL,
  next_step TEXT NOT NULL, fit_score INTEGER NOT NULL CHECK(fit_score BETWEEN 1 AND 5),
  evaluated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quota (
  day TEXT NOT NULL, kind TEXT NOT NULL, used INTEGER NOT NULL CHECK(used >= 0),
  PRIMARY KEY(day,kind)
);
CREATE TABLE IF NOT EXISTS source_stats (
  source TEXT PRIMARY KEY, successes INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0, last_success TEXT, last_failure TEXT
);
CREATE TABLE IF NOT EXISTS learning (
  source TEXT PRIMARY KEY, positive INTEGER NOT NULL DEFAULT 0,
  negative INTEGER NOT NULL DEFAULT 0, weight REAL NOT NULL DEFAULT 1.0,
  revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS update_candidates (
  repo TEXT PRIMARY KEY, tag TEXT NOT NULL, published_at TEXT,
  url TEXT NOT NULL, detected_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'review'
);

-- Revenue intelligence: evidence-labelled opportunities, founder-only records, public app monitoring.
CREATE TABLE IF NOT EXISTS app_inventory (
 path TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'unchecked' CHECK(status IN ('unchecked','online','error')),
 http_status INTEGER, checked_at TEXT, first_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_app_checked ON app_inventory(checked_at);
CREATE TABLE IF NOT EXISTS revenue_ideas (
 id TEXT PRIMARY KEY, channel TEXT NOT NULL, title TEXT NOT NULL,
 summary TEXT NOT NULL, next_step TEXT NOT NULL,
 priority INTEGER NOT NULL, effort TEXT NOT NULL, cost TEXT NOT NULL, risk TEXT NOT NULL,
 target_path TEXT, target_name TEXT NOT NULL, basis TEXT NOT NULL,
 first_seen TEXT NOT NULL, last_seen TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revenue_actions (
 idea_id TEXT PRIMARY KEY REFERENCES revenue_ideas(id) ON DELETE CASCADE,
 action TEXT NOT NULL CHECK(action IN ('shortlist','dismiss','plan')), updated_at TEXT NOT NULL
);