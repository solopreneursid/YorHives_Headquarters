-- Stores only a sequence and operational timestamps, never enquiry content.
CREATE TABLE IF NOT EXISTS hqconnect_notification_checkpoint (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 last_rowid INTEGER NOT NULL DEFAULT 0,
 last_created_at TEXT NOT NULL DEFAULT '',
 last_attempt_at TEXT,
 last_accepted_at TEXT,
 last_error_at TEXT
);
