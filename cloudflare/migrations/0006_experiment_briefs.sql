-- Founder-authored validation criteria, not evidence of demand or earnings.
ALTER TABLE founder_decisions ADD COLUMN experiment_json TEXT NOT NULL DEFAULT '{}';
