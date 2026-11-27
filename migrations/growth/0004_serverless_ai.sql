-- Optional serverless AI inference journal for Growth Intelligence.
-- Workers AI is founder-triggered only; no model calls occur during migrations.
PRAGMA foreign_keys=ON;

-- Shared with the existing HQ AI request limiter (kind=hq_workers_ai_requests).
CREATE TABLE IF NOT EXISTS quota (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  used INTEGER NOT NULL CHECK(used>=0),
  PRIMARY KEY(day,kind)
);

CREATE TABLE IF NOT EXISTS growth_ai_analyses (
  id TEXT PRIMARY KEY CHECK(length(id)=36),
  opportunity_id TEXT NOT NULL REFERENCES growth_opportunities(id) ON DELETE RESTRICT,
  specialist TEXT NOT NULL CHECK(specialist IN (
    'Engineering & Operations',
    'Research & Innovation',
    'Global Market Intelligence',
    'Product & Growth',
    'Revenue & Business',
    'Security & Independent QA'
  )),
  provider TEXT NOT NULL CHECK(provider='cloudflare-workers-ai'),
  model TEXT NOT NULL CHECK(length(model) BETWEEN 1 AND 120),
  evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
  analysis TEXT NOT NULL CHECK(length(analysis) BETWEEN 1 AND 2400),
  status TEXT NOT NULL CHECK(status='unverified-advisory'),
  generated_at TEXT NOT NULL,
  UNIQUE(opportunity_id,specialist,evidence_sha256)
);

CREATE INDEX IF NOT EXISTS idx_growth_ai_opportunity
 ON growth_ai_analyses(opportunity_id,generated_at DESC);

CREATE TRIGGER IF NOT EXISTS growth_ai_analyses_no_update
BEFORE UPDATE ON growth_ai_analyses
BEGIN
  SELECT RAISE(ABORT,'AI analysis history is append-only');
END;

CREATE TRIGGER IF NOT EXISTS growth_ai_analyses_no_delete
BEFORE DELETE ON growth_ai_analyses
BEGIN
  SELECT RAISE(ABORT,'AI analysis history is append-only');
END;

CREATE TABLE IF NOT EXISTS growth_ai_claims (
  utc_day TEXT NOT NULL CHECK(length(utc_day)=10),
  opportunity_id TEXT NOT NULL REFERENCES growth_opportunities(id) ON DELETE RESTRICT,
  specialist TEXT NOT NULL CHECK(specialist IN (
    'Engineering & Operations',
    'Research & Innovation',
    'Global Market Intelligence',
    'Product & Growth',
    'Revenue & Business',
    'Security & Independent QA'
  )),
  evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
  claim_id TEXT NOT NULL UNIQUE CHECK(length(claim_id)=36),
  state TEXT NOT NULL CHECK(state IN ('reserved','completed','failed','budget-exhausted')),
  claimed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(utc_day,opportunity_id,specialist,evidence_sha256)
);
CREATE INDEX IF NOT EXISTS idx_growth_ai_claim_state
 ON growth_ai_claims(utc_day,state,updated_at);
