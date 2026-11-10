-- Reporter feedback replay protection and provider-neutral delivery attempt evidence.
BEGIN;

ALTER TABLE reporter_feedback_events
  ADD COLUMN IF NOT EXISTS client_mutation_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS reporter_feedback_org_client_mutation_uidx
  ON reporter_feedback_events(organization_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS reporter_feedback_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  feedback_event_id uuid NOT NULL,
  attempt_no integer NOT NULL CHECK (attempt_no >= 1 AND attempt_no <= 100),
  status text NOT NULL CHECK (status IN ('sent','delivered','failed')),
  provider_reference text CHECK (provider_reference IS NULL OR length(provider_reference) <= 200),
  error_class text CHECK (error_class IS NULL OR error_class IN ('temporary','permanent','configuration','unknown')),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE (organization_id, feedback_event_id, attempt_no),
  FOREIGN KEY (organization_id, feedback_event_id) REFERENCES reporter_feedback_events(organization_id,id) ON DELETE RESTRICT,
  CHECK (status <> 'delivered' OR delivered_at IS NOT NULL),
  CHECK (status = 'delivered' OR delivered_at IS NULL)
);

CREATE INDEX IF NOT EXISTS reporter_feedback_delivery_due_idx
  ON reporter_feedback_delivery_attempts(organization_id, feedback_event_id, attempt_no DESC);

ALTER TABLE reporter_feedback_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporter_feedback_delivery_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON reporter_feedback_delivery_attempts
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

CREATE OR REPLACE FUNCTION reject_reporter_feedback_delivery_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'reporter feedback delivery attempts are append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER reporter_feedback_delivery_no_update
  BEFORE UPDATE OR DELETE ON reporter_feedback_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION reject_reporter_feedback_delivery_mutation();

COMMIT;
