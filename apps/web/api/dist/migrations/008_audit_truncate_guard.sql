-- Keep audit_events append-only for ordinary SQL mutations, including TRUNCATE.
-- This trigger is defense in depth; runtime roles must still lack TRUNCATE and DDL privileges.
BEGIN;

CREATE TRIGGER audit_events_no_truncate
BEFORE TRUNCATE ON audit_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();

COMMIT;
