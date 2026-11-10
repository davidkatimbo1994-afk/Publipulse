-- Audit metadata must be a JSON object, never an arbitrary scalar or array.
-- This constrains shape only; application-level minimization and size limits still apply.
BEGIN;

ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_metadata_object_check
  CHECK (jsonb_typeof(metadata) = 'object');

COMMIT;
