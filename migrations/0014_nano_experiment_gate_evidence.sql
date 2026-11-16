-- Phase 18: private, append-only founder evidence submissions.
-- A submitted link is NOT independently verified, legal clearance, approval,
-- permission to execute, or consent to spend. HQ agents cannot write.
CREATE TABLE IF NOT EXISTS nano_experiment_gate_evidence (
 entry_id TEXT PRIMARY KEY,
 paper_id TEXT NOT NULL REFERENCES nano_journal_papers(paper_id),
 gate_key TEXT NOT NULL CHECK(gate_key IN (
  'authorship','source','dependencies','licenses','data',
  'isolation','hardware','cost','acceptance','permission')),
 revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 25),
 repository_url TEXT NOT NULL,
 manifest_sha TEXT NOT NULL DEFAULT '',
 founder_review_version INTEGER NOT NULL CHECK(founder_review_version BETWEEN 0 AND 25),
 assessment TEXT NOT NULL CHECK(assessment IN (
  'needs-review','evidence-submitted','blocker-reported')),
 evidence_type TEXT NOT NULL CHECK(evidence_type IN (
  'research-source','code-or-license','independent-qa','measurement','other')),
 evidence_url TEXT NOT NULL CHECK(length(evidence_url) BETWEEN 12 AND 420),
 explanation TEXT NOT NULL CHECK(length(explanation) BETWEEN 20 AND 350),
 recorded_at TEXT NOT NULL,
 UNIQUE(paper_id,gate_key,revision)
);
CREATE INDEX IF NOT EXISTS idx_nano_experiment_gate_evidence_paper
 ON nano_experiment_gate_evidence(paper_id,gate_key,revision DESC);
CREATE INDEX IF NOT EXISTS idx_nano_experiment_gate_evidence_recent
 ON nano_experiment_gate_evidence(recorded_at DESC);
