-- Controlled upstream event intake provenance and replay protection.
BEGIN;

CREATE TABLE upstream_event_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  integration_profile_id uuid NOT NULL REFERENCES integration_profiles(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('dhis2','fhir','other')),
  external_event_id text NOT NULL CHECK (length(trim(external_event_id)) BETWEEN 1 AND 240),
  contract_version text NOT NULL CHECK (contract_version ~ '^[0-9]+\\.[0-9]+$'),
  signal_id uuid NOT NULL,
  received_by uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, integration_profile_id, provider, external_event_id),
  UNIQUE (organization_id, id)
);

CREATE INDEX upstream_event_receipts_signal_idx ON upstream_event_receipts(organization_id, signal_id);

ALTER TABLE upstream_event_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE upstream_event_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY upstream_event_receipts_tenant_policy ON upstream_event_receipts
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

REVOKE UPDATE, DELETE ON upstream_event_receipts FROM PUBLIC;

CREATE OR REPLACE FUNCTION reject_upstream_event_receipt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'upstream event receipts are append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER upstream_event_receipts_no_update
  BEFORE UPDATE OR DELETE ON upstream_event_receipts
  FOR EACH ROW EXECUTE FUNCTION reject_upstream_event_receipt_mutation();

COMMIT;
