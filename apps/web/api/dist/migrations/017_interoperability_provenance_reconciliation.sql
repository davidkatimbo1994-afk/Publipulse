-- Phase 7D: interoperability provenance and reconciliation.
-- Records evidence about mapping/transformation and compares local vs external exchange results.
-- This migration does not perform external I/O and does not make an exchange successful by itself.
BEGIN;

ALTER TABLE interoperability_exchange_receipts
  ADD COLUMN receipt_fingerprint text,
  ADD COLUMN response_digest text,
  ADD COLUMN transport_verified boolean NOT NULL DEFAULT false;

CREATE TABLE interoperability_provenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  exchange_job_id uuid NOT NULL REFERENCES interoperability_exchange_jobs(id) ON DELETE RESTRICT,
  stage text NOT NULL CHECK (stage IN ('source','validated','mapped','transformed','submitted','acknowledged','reconciled')),
  direction text NOT NULL CHECK (direction IN ('import','export')),
  source_system text NOT NULL CHECK (length(trim(source_system)) BETWEEN 1 AND 160),
  source_record_id text CHECK (source_record_id IS NULL OR length(trim(source_record_id)) BETWEEN 1 AND 240),
  source_version text CHECK (source_version IS NULL OR length(trim(source_version)) BETWEEN 1 AND 120),
  indicator_code text CHECK (indicator_code IS NULL OR length(trim(indicator_code)) BETWEEN 1 AND 120),
  country_code char(2) REFERENCES country_configs(country_code) ON DELETE RESTRICT,
  programme_code text,
  mapping_version text CHECK (mapping_version IS NULL OR length(trim(mapping_version)) BETWEEN 1 AND 80),
  transformation_profile text CHECK (transformation_profile IS NULL OR length(trim(transformation_profile)) BETWEEN 1 AND 160),
  value_numeric numeric,
  unit text CHECK (unit IS NULL OR length(unit) <= 80),
  evidence_digest text CHECK (evidence_digest IS NULL OR length(trim(evidence_digest)) BETWEEN 16 AND 200),
  observed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);
CREATE INDEX interoperability_provenance_job_idx ON interoperability_provenance_events(organization_id, exchange_job_id, created_at);
CREATE INDEX interoperability_provenance_indicator_idx ON interoperability_provenance_events(organization_id, indicator_code, country_code, created_at DESC);

CREATE TABLE interoperability_reconciliation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  exchange_job_id uuid NOT NULL REFERENCES interoperability_exchange_jobs(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('dhis2','fhir','csv','other')),
  contract_fingerprint text NOT NULL,
  local_record_count bigint NOT NULL CHECK (local_record_count >= 0),
  external_record_count bigint NOT NULL CHECK (external_record_count >= 0),
  local_total numeric,
  external_total numeric,
  tolerance numeric NOT NULL DEFAULT 0 CHECK (tolerance >= 0),
  delta numeric,
  count_delta bigint GENERATED ALWAYS AS (external_record_count - local_record_count) STORED,
  status text NOT NULL CHECK (status IN ('exact','within_tolerance','mismatch','not_comparable')),
  evidence_digest text CHECK (evidence_digest IS NULL OR length(trim(evidence_digest)) BETWEEN 16 AND 200),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  evaluated_by uuid NOT NULL,
  UNIQUE (exchange_job_id)
);
CREATE INDEX interoperability_reconciliation_org_status_idx ON interoperability_reconciliation_snapshots(organization_id, status, evaluated_at DESC);

ALTER TABLE interoperability_provenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE interoperability_reconciliation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY interoperability_provenance_tenant ON interoperability_provenance_events
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY interoperability_reconciliation_tenant ON interoperability_reconciliation_snapshots
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

CREATE OR REPLACE FUNCTION prevent_interoperability_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'interoperability evidence is append-only';
END;
$$;

CREATE TRIGGER interoperability_provenance_append_only
BEFORE UPDATE OR DELETE ON interoperability_provenance_events
FOR EACH ROW EXECUTE FUNCTION prevent_interoperability_evidence_mutation();

CREATE TRIGGER interoperability_reconciliation_append_only
BEFORE UPDATE OR DELETE ON interoperability_reconciliation_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_interoperability_evidence_mutation();

CREATE OR REPLACE FUNCTION prevent_interoperability_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'interoperability receipts are append-only';
END;
$$;

CREATE TRIGGER interoperability_receipt_append_only
BEFORE UPDATE OR DELETE ON interoperability_exchange_receipts
FOR EACH ROW EXECUTE FUNCTION prevent_interoperability_receipt_mutation();

COMMENT ON TABLE interoperability_provenance_events IS 'Append-only evidence trail for source, mapping, transformation, submission and reconciliation stages. Does not store credentials.';
COMMENT ON TABLE interoperability_reconciliation_snapshots IS 'Append-only comparison evidence between PubliPulse and an external exchange result; mismatch never becomes success automatically.';

COMMIT;
