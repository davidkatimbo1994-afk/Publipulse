-- Version response actions for safe concurrent edits. Apply after migrations 001 and 002.
BEGIN;
ALTER TABLE response_actions ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
CREATE INDEX decisions_signal_created_idx ON decisions (organization_id, signal_id, created_at DESC);
CREATE INDEX response_actions_signal_created_idx ON response_actions (organization_id, signal_id, created_at DESC);
COMMIT;
