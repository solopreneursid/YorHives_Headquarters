-- Phase 9: portable, zero-inference source-linked opportunity dossiers.
-- Dossiers are automatically generated research hypotheses, NOT founder approvals,
-- verified revenue, customer demand, executable tasks or independent model assessments.
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
CREATE INDEX IF NOT EXISTS idx_nano_opportunity_briefs_priority
 ON nano_opportunity_briefs(stage,priority DESC,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_opportunity_briefs_source
 ON nano_opportunity_briefs(source_id);
