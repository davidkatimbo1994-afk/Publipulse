-- Replay-safe weekly decision evidence.
BEGIN;

ALTER TABLE weekly_review_decisions
  ADD COLUMN client_mutation_id text;

UPDATE weekly_review_decisions
SET client_mutation_id = gen_random_uuid()::text
WHERE client_mutation_id IS NULL;

ALTER TABLE weekly_review_decisions
  ALTER COLUMN client_mutation_id SET NOT NULL;

ALTER TABLE weekly_review_decisions
  ADD CONSTRAINT weekly_review_decisions_client_mutation_id_format
  CHECK (client_mutation_id ~ '^[A-Za-z0-9._:-]{16,128}$');

CREATE UNIQUE INDEX weekly_review_decisions_org_mutation_uidx
  ON weekly_review_decisions(organization_id, client_mutation_id);

COMMIT;
