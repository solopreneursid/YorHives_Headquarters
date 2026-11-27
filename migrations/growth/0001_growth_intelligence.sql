-- Growth Intelligence v1 — optional, additive D1/SQLite schema.
-- Apply only after founder-reviewed release approval; NOT an old HQpulse migration.
-- HQ's own research metadata only: no visitor identities, contacts, email lists, or tokens.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS growth_projects (
  id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 2 AND 40),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  stage TEXT NOT NULL DEFAULT 'research',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS growth_audiences (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES growth_projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK(length(label) BETWEEN 2 AND 100),
  rationale TEXT NOT NULL DEFAULT '',
  evidence_status TEXT NOT NULL DEFAULT 'hypothesis'
    CHECK(evidence_status IN ('hypothesis','public-signal','verified-aggregate')),
  UNIQUE(project_id,label)
);
CREATE TABLE IF NOT EXISTS growth_sources (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL CHECK(length(source_url) BETWEEN 12 AND 500),
  source_type TEXT NOT NULL CHECK(length(source_type) BETWEEN 1 AND 70),
  observed_at TEXT NOT NULL,
  fetched_at TEXT,
  status TEXT NOT NULL DEFAULT 'source-unverified'
    CHECK(status IN ('source-unverified','public-observed','unavailable')),
  UNIQUE(source_url,source_type,observed_at)
);
CREATE TABLE IF NOT EXISTS growth_opportunities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES growth_projects(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES growth_sources(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 8 AND 150),
  summary TEXT NOT NULL CHECK(length(summary) BETWEEN 12 AND 600),
  relevance_score INTEGER NOT NULL CHECK(relevance_score BETWEEN 0 AND 100),
  audience_hypothesis TEXT NOT NULL,
  demand_verified INTEGER NOT NULL DEFAULT 0 CHECK(demand_verified IN (0,1)),
  approval_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK(approval_status IN ('unreviewed','needs-evidence','approved-for-founder','rejected','founder-executed')),
  discovered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(project_id,source_id,title)
);
CREATE TABLE IF NOT EXISTS growth_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id TEXT NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  review_note TEXT NOT NULL DEFAULT '' CHECK(length(review_note)<=600),
  reviewed_at TEXT NOT NULL,
  reviewed_by TEXT NOT NULL DEFAULT 'founder' CHECK(reviewed_by='founder')
);
CREATE TABLE IF NOT EXISTS growth_drafts (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel IN ('partnership','community')),
  subject TEXT NOT NULL CHECK(length(subject)<=200),
  body TEXT NOT NULL CHECK(length(body)<=3000),
  status TEXT NOT NULL DEFAULT 'requires-founder-review'
    CHECK(status IN ('requires-founder-review','reviewed','archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS growth_outcomes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES growth_projects(id) ON DELETE CASCADE,
  opportunity_id TEXT REFERENCES growth_opportunities(id) ON DELETE SET NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('first-party-aggregate','founder-attested','verified-payout-ledger')),
  page_views INTEGER CHECK(page_views IS NULL OR page_views>=0),
  completed_actions INTEGER CHECK(completed_actions IS NULL OR completed_actions>=0),
  verified_revenue_minor INTEGER,
  currency TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(period_start<=period_end),
  CHECK(verified_revenue_minor IS NULL OR (verified_revenue_minor>=0 AND currency IS NOT NULL AND source_type='verified-payout-ledger')),
  CHECK(currency IS NULL OR (length(currency)=3 AND currency=upper(currency)))
);
CREATE INDEX IF NOT EXISTS idx_growth_opportunity_rank
 ON growth_opportunities(project_id,relevance_score DESC,discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_opportunity_review
 ON growth_opportunities(project_id,approval_status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_reviews_history
 ON growth_reviews(opportunity_id,reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_outcome_period
 ON growth_outcomes(project_id,period_end DESC);
