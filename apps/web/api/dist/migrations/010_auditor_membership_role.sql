-- Align the persisted membership roles with the dedicated audit-reader authorization path.
-- This adds a narrowly scoped role; it does not grant database privileges by itself.
BEGIN;

ALTER TABLE organization_memberships
  DROP CONSTRAINT organization_memberships_role_check;

ALTER TABLE organization_memberships
  ADD CONSTRAINT organization_memberships_role_check
  CHECK (role IN ('owner','administrator','reviewer','investigator','responder','analyst','read_only','auditor'));

COMMIT;
