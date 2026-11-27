-- Optional founder-reviewed growth decision journal.
-- Apply only after 0001 in an approved D1 staging/release migration.
-- Every transition is one conditional INSERT; trigger updates the projection
-- in the same SQLite statement transaction. No external actions are encoded.
CREATE TRIGGER IF NOT EXISTS growth_review_guard
BEFORE INSERT ON growth_reviews
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM growth_opportunities o WHERE o.id=NEW.opportunity_id
      AND o.approval_status=NEW.from_status
  ) THEN RAISE(ABORT,'growth review state mismatch') END;
  SELECT CASE WHEN NOT (
    (NEW.from_status IN ('unreviewed','needs-evidence','rejected')
      AND NEW.to_status IN ('needs-evidence','approved-for-founder','rejected')
      AND NEW.from_status<>NEW.to_status)
    OR
    (NEW.from_status='approved-for-founder'
      AND NEW.to_status IN ('needs-evidence','rejected','founder-executed'))
  ) THEN RAISE(ABORT,'invalid growth review transition') END;
END;

CREATE TRIGGER IF NOT EXISTS growth_review_projection
AFTER INSERT ON growth_reviews
BEGIN
  UPDATE growth_opportunities SET approval_status=NEW.to_status,
    updated_at=NEW.reviewed_at WHERE id=NEW.opportunity_id;
END;

CREATE TRIGGER IF NOT EXISTS growth_review_no_update
BEFORE UPDATE ON growth_reviews
BEGIN
  SELECT RAISE(ABORT,'growth review events are append-only');
END;

CREATE INDEX IF NOT EXISTS idx_growth_review_revision
 ON growth_reviews(opportunity_id,id DESC);
