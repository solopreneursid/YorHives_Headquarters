-- Append-only founder metadata, isolated from observed websites and source.
-- SQLite-compatible. Applying this migration does not enable the write route.
CREATE TABLE IF NOT EXISTS founder_decisions (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  thread TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision > 0),
  kind TEXT NOT NULL CHECK(kind IN ('finding','opportunity')), record_id TEXT NOT NULL,
  title TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('proposed','accepted','rejected','snoozed','implemented','verified')),
  note TEXT NOT NULL, feedback TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL DEFAULT '',
  success_condition TEXT NOT NULL DEFAULT '', evidence_url TEXT NOT NULL DEFAULT '',
  snapshot TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(thread,revision)
);
CREATE INDEX IF NOT EXISTS idx_founder_thread ON founder_decisions(thread,revision DESC);
