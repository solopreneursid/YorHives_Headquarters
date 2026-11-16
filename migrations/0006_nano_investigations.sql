-- Nano Phase 6: additive, portable SQLite/D1 public-source investigation ledger.
-- Metadata is never proof of functionality, customer demand, verified revenue, or legal reuse.
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
CREATE INDEX IF NOT EXISTS idx_nano_investigations_due ON nano_investigations(next_check_at);
CREATE INDEX IF NOT EXISTS idx_nano_investigations_state ON nano_investigations(state,checked_at DESC);
