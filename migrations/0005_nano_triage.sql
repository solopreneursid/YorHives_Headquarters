-- Nano Phase 5: portable D1 / SQLite evidence-aware automatic triage.
-- An assessment never verifies a source or triggers a deployment.
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
CREATE INDEX IF NOT EXISTS idx_nano_triage_priority ON nano_triage(state,score DESC,assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_triage_source ON nano_triage(source_kind,source_id,assessed_at DESC);
