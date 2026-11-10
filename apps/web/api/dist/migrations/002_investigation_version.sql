-- Add optimistic concurrency to investigations. Apply after 001_initial_action_graph.sql.
BEGIN;
ALTER TABLE investigations ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
CREATE INDEX investigations_signal_opened_idx ON investigations (organization_id, signal_id, opened_at DESC);
COMMIT;
