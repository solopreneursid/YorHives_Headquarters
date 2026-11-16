-- Phase 4: append-only, founder-reviewed learning; portable SQLite/D1.
-- Apply once to the existing HQ intelligence database, without touching source evidence.
CREATE TABLE IF NOT EXISTS nano_playbooks (
  entry_id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  department TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version >= 1),
  outcome TEXT NOT NULL CHECK(outcome IN ('useful','not-useful','needs-evidence')),
  guidance TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_url TEXT NOT NULL DEFAULT '',
  source_evidence_state TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  UNIQUE(memory_id, version),
  FOREIGN KEY(memory_id) REFERENCES nano_memories(memory_id)
);
CREATE INDEX IF NOT EXISTS idx_nano_playbooks_recent ON nano_playbooks(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nano_playbooks_memory ON nano_playbooks(memory_id,version DESC);
