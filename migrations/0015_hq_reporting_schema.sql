-- HQ reporting schema bootstrap for isolated staging databases.
-- Schema-only source: existing HQ production sqlite_master definitions.
-- No production records, secrets, or founder evidence are copied.
-- Safe to re-run: table and index creation is guarded with IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS assets (
  url TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'tool',
  first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, last_checked TEXT,
  http_status INTEGER, failures INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'unverified'
, discovery_source TEXT NOT NULL DEFAULT 'unknown', evidence_url TEXT NOT NULL DEFAULT '', inventory_confidence TEXT NOT NULL DEFAULT 'unverified', page_fingerprint TEXT NOT NULL DEFAULT '', changed_at TEXT, features_json TEXT NOT NULL DEFAULT '[]');

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY, category TEXT NOT NULL, priority TEXT NOT NULL,
  asset TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
  recommendation TEXT NOT NULL, evidence TEXT NOT NULL,
  observed_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS founder_decisions (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  thread TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision > 0),
  kind TEXT NOT NULL CHECK(kind IN ('finding','opportunity')), record_id TEXT NOT NULL,
  title TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('proposed','accepted','rejected','snoozed','implemented','verified')),
  note TEXT NOT NULL, feedback TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL DEFAULT '',
  success_condition TEXT NOT NULL DEFAULT '', evidence_url TEXT NOT NULL DEFAULT '',
  snapshot TEXT NOT NULL, created_at TEXT NOT NULL, experiment_json TEXT NOT NULL DEFAULT '{}', UNIQUE(thread,revision)
);

CREATE TABLE IF NOT EXISTS incident_events (sequence INTEGER PRIMARY KEY AUTOINCREMENT,incident_id TEXT NOT NULL,transition TEXT NOT NULL CHECK(transition IN ('detected','reopened','resolved','historical')),observed_at TEXT NOT NULL,evidence TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS incident_history (id TEXT PRIMARY KEY,title TEXT NOT NULL,category TEXT NOT NULL,severity TEXT NOT NULL,asset TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('open','resolved')),first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,resolved_at TEXT,description TEXT NOT NULL,recommendation TEXT NOT NULL,evidence TEXT NOT NULL,occurrences INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS nano_experiment_gate_evidence (entry_id TEXT PRIMARY KEY,paper_id TEXT NOT NULL REFERENCES nano_journal_papers(paper_id),gate_key TEXT NOT NULL CHECK(gate_key IN ('authorship','source','dependencies','licenses','data','isolation','hardware','cost','acceptance','permission')),revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 25),repository_url TEXT NOT NULL,manifest_sha TEXT NOT NULL DEFAULT '',founder_review_version INTEGER NOT NULL CHECK(founder_review_version BETWEEN 0 AND 25),assessment TEXT NOT NULL CHECK(assessment IN ('needs-review','evidence-submitted','blocker-reported')),evidence_type TEXT NOT NULL CHECK(evidence_type IN ('research-source','code-or-license','independent-qa','measurement','other')),evidence_url TEXT NOT NULL CHECK(length(evidence_url) BETWEEN 12 AND 420),explanation TEXT NOT NULL CHECK(length(explanation) BETWEEN 20 AND 350),recorded_at TEXT NOT NULL,UNIQUE(paper_id,gate_key,revision));

CREATE TABLE IF NOT EXISTS nano_implementation_checks (
 paper_id TEXT PRIMARY KEY REFERENCES nano_journal_papers(paper_id),
 state TEXT NOT NULL CHECK (state IN (
  'page-unavailable','no-repository-link-observed','repository-link-observed',
  'repository-metadata-checked','repository-unavailable')),
 repository_url TEXT,
 license_spdx TEXT,
 facts_json TEXT NOT NULL DEFAULT '{}',
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 20),
 checked_at TEXT NOT NULL,
 next_check_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nano_investigations (
 memory_id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL,
 title TEXT NOT NULL,
 department TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('unsupported-source','source-unavailable','primary-metadata-confirmed','cross-platform-metadata-confirmed')),
 primary_url TEXT NOT NULL DEFAULT '',
 secondary_url TEXT NOT NULL DEFAULT '',
 facts_json TEXT NOT NULL DEFAULT '[]',
 checklist_json TEXT NOT NULL DEFAULT '[]',
 error_code TEXT NOT NULL DEFAULT '',
 source_fingerprint TEXT NOT NULL,
 checked_at TEXT NOT NULL,
 next_check_at TEXT NOT NULL,
 FOREIGN KEY(memory_id) REFERENCES nano_memories(memory_id)
);

CREATE TABLE IF NOT EXISTS nano_journal_papers (
 paper_id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL CHECK(source_id IN ('crossref','arxiv')),
 topic_id TEXT NOT NULL,
 title TEXT NOT NULL,
 source_url TEXT NOT NULL UNIQUE,
 source_type TEXT NOT NULL,
 abstract_text TEXT NOT NULL DEFAULT '',
 published_at TEXT NOT NULL DEFAULT '',
 citation_count INTEGER,
 assessment_json TEXT NOT NULL,
 first_seen TEXT NOT NULL,
 last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nano_journal_scans (
 source_id TEXT PRIMARY KEY CHECK(source_id IN ('crossref','arxiv')),
 state TEXT NOT NULL CHECK(state IN ('ok','unavailable','rate-limited')),
 detail TEXT NOT NULL,
 topic_id TEXT NOT NULL,
 added INTEGER NOT NULL CHECK(added BETWEEN 0 AND 5),
 checked_at TEXT NOT NULL,
 next_check_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nano_manifest_evidence (paper_id TEXT PRIMARY KEY REFERENCES nano_journal_papers(paper_id),repository_url TEXT NOT NULL,state TEXT NOT NULL CHECK (state IN ('catalogued','partial','complete','no-known-root-files','unavailable')),catalog_json TEXT NOT NULL DEFAULT '[]',evidence_json TEXT NOT NULL DEFAULT '[]',attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 50),checked_at TEXT NOT NULL,next_check_at TEXT NOT NULL,error_code TEXT);

CREATE TABLE IF NOT EXISTS nano_memories (memory_id TEXT PRIMARY KEY, run_id TEXT NOT NULL UNIQUE, source_kind TEXT NOT NULL CHECK(source_kind IN ('finding','opportunity')), source_id TEXT NOT NULL, department TEXT NOT NULL, title TEXT NOT NULL, evidence_state TEXT NOT NULL, source_url TEXT NOT NULL, recommendation TEXT NOT NULL, review_state TEXT NOT NULL, observed_at TEXT NOT NULL, recorded_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS nano_opportunity_briefs (
 memory_id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL,
 title TEXT NOT NULL,
 category TEXT NOT NULL,
 stage TEXT NOT NULL CHECK(stage IN ('research-needed','monitor','filtered')),
 priority INTEGER NOT NULL CHECK(priority BETWEEN 0 AND 100),
 source_fingerprint TEXT NOT NULL,
 brief_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 FOREIGN KEY(memory_id) REFERENCES nano_memories(memory_id)
);

CREATE TABLE IF NOT EXISTS nano_playbooks (entry_id TEXT PRIMARY KEY,memory_id TEXT NOT NULL,department TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>=1),outcome TEXT NOT NULL CHECK(outcome IN ('useful','not-useful','needs-evidence')),guidance TEXT NOT NULL,reason TEXT NOT NULL,evidence_url TEXT NOT NULL DEFAULT '',source_evidence_state TEXT NOT NULL,reviewed_at TEXT NOT NULL,UNIQUE(memory_id,version),FOREIGN KEY(memory_id) REFERENCES nano_memories(memory_id));

CREATE TABLE IF NOT EXISTS nano_research_founder_reviews (entry_id TEXT PRIMARY KEY,paper_id TEXT NOT NULL REFERENCES nano_journal_papers(paper_id),repository_url TEXT NOT NULL,manifest_sha TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 25),disposition TEXT NOT NULL CHECK(disposition IN ('needs-evidence','manual-shortlist','defer','plan-isolated-test')),license_concern TEXT NOT NULL CHECK(license_concern IN ('unreviewed','manual-legal-review','blocker-observed')),technical_concern TEXT NOT NULL CHECK(technical_concern IN ('unknown','needs-validation','blocked')),max_budget_inr INTEGER NOT NULL CHECK(max_budget_inr BETWEEN 0 AND 5000),max_runtime_minutes INTEGER NOT NULL CHECK(max_runtime_minutes BETWEEN 0 AND 120),reason TEXT NOT NULL CHECK(length(reason) BETWEEN 16 AND 350),next_step TEXT NOT NULL CHECK(length(next_step) BETWEEN 16 AND 350),reviewed_at TEXT NOT NULL,UNIQUE(paper_id,version));

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

CREATE TABLE IF NOT EXISTS nano_source_scans (
 source_id TEXT PRIMARY KEY,
 state TEXT NOT NULL CHECK(state IN ('listing-recorded','unavailable')),
 detail TEXT NOT NULL,
 added INTEGER NOT NULL CHECK(added BETWEEN 0 AND 2),
 checked_at TEXT NOT NULL,
 next_check_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nano_triage (
 memory_id TEXT PRIMARY KEY,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('finding','opportunity')),
 source_id TEXT NOT NULL,
 department TEXT NOT NULL,
 title TEXT NOT NULL,
 score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
 state TEXT NOT NULL CHECK(state IN ('review-now','research-first')),
 next_action TEXT NOT NULL,
 source_url TEXT NOT NULL,
 evidence_state TEXT NOT NULL,
 reasons_json TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 assessed_at TEXT NOT NULL,
 ai_analysis TEXT NOT NULL DEFAULT '',
 ai_model TEXT NOT NULL DEFAULT '',
 ai_at TEXT NOT NULL DEFAULT '',
 FOREIGN KEY(memory_id) REFERENCES nano_memories(memory_id)
);

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

CREATE TABLE IF NOT EXISTS product_intel_leads (id TEXT PRIMARY KEY, title TEXT NOT NULL, product_url TEXT NOT NULL, found_via TEXT NOT NULL, observed_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'discovered');

CREATE TABLE IF NOT EXISTS product_intel_signals (product_id TEXT NOT NULL, metric TEXT NOT NULL, observed_day TEXT NOT NULL, value INTEGER NOT NULL, observed_at TEXT NOT NULL, evidence_url TEXT NOT NULL, PRIMARY KEY(product_id,metric,observed_day));

CREATE TABLE IF NOT EXISTS product_intel_sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, adapter TEXT NOT NULL, query_text TEXT NOT NULL, site TEXT NOT NULL, discovered_by TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, checked_at TEXT, next_due_at TEXT, last_status TEXT, checks INTEGER NOT NULL DEFAULT 0, hits INTEGER NOT NULL DEFAULT 0);

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

CREATE TABLE IF NOT EXISTS workflow_runs (run_id TEXT PRIMARY KEY,source_kind TEXT NOT NULL CHECK(source_kind IN ('finding','opportunity')),source_id TEXT NOT NULL,department TEXT NOT NULL,revision INTEGER NOT NULL,stage TEXT NOT NULL,review_state TEXT NOT NULL,evidence_state TEXT NOT NULL,title TEXT NOT NULL,recommendation TEXT NOT NULL,stages_json TEXT NOT NULL,observed_at TEXT NOT NULL,created_at TEXT NOT NULL);

CREATE INDEX IF NOT EXISTS idx_assets_checked ON assets(last_checked);
CREATE INDEX IF NOT EXISTS idx_assets_confidence ON assets(kind,inventory_confidence);
CREATE INDEX IF NOT EXISTS idx_findings_seen ON findings(observed_at);
CREATE INDEX IF NOT EXISTS idx_founder_thread ON founder_decisions(thread,revision DESC);
CREATE INDEX IF NOT EXISTS idx_incident_events_incident ON incident_events(incident_id,sequence DESC);
CREATE INDEX IF NOT EXISTS idx_nano_experiment_gate_evidence_paper ON nano_experiment_gate_evidence(paper_id,gate_key,revision DESC);
CREATE INDEX IF NOT EXISTS idx_nano_experiment_gate_evidence_recent ON nano_experiment_gate_evidence(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_implementation_checks_due
 ON nano_implementation_checks(next_check_at,checked_at);
CREATE INDEX IF NOT EXISTS idx_nano_implementation_checks_state
 ON nano_implementation_checks(state,checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_investigations_due ON nano_investigations(next_check_at);
CREATE INDEX IF NOT EXISTS idx_nano_investigations_state ON nano_investigations(state,checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_journal_papers_recent ON nano_journal_papers(published_at DESC,last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_nano_journal_papers_topic ON nano_journal_papers(topic_id,published_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_manifest_evidence_due ON nano_manifest_evidence(next_check_at,checked_at);
CREATE INDEX IF NOT EXISTS idx_nano_manifest_evidence_state ON nano_manifest_evidence(state,checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_memories_department ON nano_memories(department,recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_memories_recent ON nano_memories(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_opportunity_briefs_priority
 ON nano_opportunity_briefs(stage,priority DESC,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_opportunity_briefs_source
 ON nano_opportunity_briefs(source_id);
CREATE INDEX IF NOT EXISTS idx_nano_playbooks_memory ON nano_playbooks(memory_id,version DESC);
CREATE INDEX IF NOT EXISTS idx_nano_playbooks_recent ON nano_playbooks(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_research_founder_reviews_paper ON nano_research_founder_reviews(paper_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_nano_research_founder_reviews_recent ON nano_research_founder_reviews(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_science_reviews_priority
 ON nano_science_reviews(stage,research_priority DESC,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_science_reviews_updated
 ON nano_science_reviews(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_source_leads_recent ON nano_source_leads(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_source_leads_source ON nano_source_leads(source_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_triage_priority ON nano_triage(state,score DESC,assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_triage_source ON nano_triage(source_kind,source_id,assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_seen ON opportunities(observed_at);
CREATE INDEX IF NOT EXISTS idx_product_hypotheses_recent ON product_hypotheses(observed_at);
CREATE INDEX IF NOT EXISTS idx_security_watch_seen ON security_watch(observed_at);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_recent ON workflow_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_source ON workflow_runs(source_kind,source_id,revision DESC);
CREATE INDEX IF NOT EXISTS product_intel_due ON product_intel_sources(state,next_due_at,checked_at);
CREATE INDEX IF NOT EXISTS product_intel_signal_history ON product_intel_signals(product_id,metric,observed_at DESC);
