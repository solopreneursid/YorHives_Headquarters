-- Operational heartbeat only. No enquiry content, IDs, counts, or addresses.
CREATE TABLE IF NOT EXISTS hqconnect_notification_health (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 last_checked_at TEXT NOT NULL,
 last_result TEXT NOT NULL CHECK (last_result IN ('ok','error'))
);
