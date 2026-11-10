-- Offline outcome replay: bind a client mutation to one outcome per organization.
-- This prevents duplicate outcome assessments during retry/reconnect.
BEGIN;
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS client_mutation_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS outcomes_org_client_mutation_uidx
  ON outcomes(organization_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;
COMMIT;
