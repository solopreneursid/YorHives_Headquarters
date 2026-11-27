-- Internal founder attestations, not verified sales or payment evidence.
CREATE TABLE IF NOT EXISTS growth_intent_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 opportunity_id TEXT NOT NULL REFERENCES growth_opportunities(id) ON DELETE RESTRICT,
 event_key TEXT NOT NULL UNIQUE CHECK(length(event_key)=36),
 outcome TEXT NOT NULL CHECK(outcome IN ('no-response','declined','asked-information','requested-demo','requested-proposal','founder-reported-agreement','do-not-contact')),
 occurred_at TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 source_type TEXT NOT NULL DEFAULT 'founder-attested' CHECK(source_type='founder-attested')
);
CREATE INDEX IF NOT EXISTS growth_intent_by_opportunity ON growth_intent_events(opportunity_id,id DESC);
CREATE TRIGGER IF NOT EXISTS growth_intent_insert_guard BEFORE INSERT ON growth_intent_events BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM growth_opportunities WHERE id=NEW.opportunity_id AND approval_status='founder-executed')
 THEN RAISE(ABORT,'manual founder action required') END;
END;
CREATE TRIGGER IF NOT EXISTS growth_intent_no_update BEFORE UPDATE ON growth_intent_events BEGIN
 SELECT RAISE(ABORT,'intent history is append-only');
END;
CREATE TRIGGER IF NOT EXISTS growth_intent_no_delete BEFORE DELETE ON growth_intent_events BEGIN
 SELECT RAISE(ABORT,'intent history is append-only');
END;
