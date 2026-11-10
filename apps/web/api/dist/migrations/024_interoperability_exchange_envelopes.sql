-- Phase 7 completion: provider-neutral exchange evidence envelope.
-- This records the contract/payload boundary for future DHIS2/FHIR/CSV adapters.
-- It does not perform external I/O and does not imply external transfer.
BEGIN;

CREATE TABLE interoperability_exchange_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  exchange_job_id uuid NOT NULL REFERENCES interoperability_exchange_jobs(id) ON DELETE RESTRICT,
  schema_version text NOT NULL CHECK (schema_version = '1.0'),
  provider text NOT NULL CHECK (provider IN ('dhis2','fhir','csv','other')),
  format text NOT NULL CHECK (format IN ('dhis2_data_value_set','fhir_bundle','csv_aggregate')),
  direction text NOT NULL CHECK (direction IN ('import','export')),
  country_code char(2) NOT NULL REFERENCES country_configs(country_code) ON DELETE RESTRICT,
  programme_code text,
  indicator_codes jsonb NOT NULL CHECK (jsonb_typeof(indicator_codes) = 'array'),
  mapping_version text NOT NULL CHECK (length(trim(mapping_version)) BETWEEN 1 AND 80),
  administrative_unit_mapping_version text,
  purpose text NOT NULL CHECK (length(trim(purpose)) BETWEEN 3 AND 500),
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  record_count bigint NOT NULL CHECK (record_count >= 0),
  suppression_applied boolean NOT NULL DEFAULT false,
  minimum_cell_size integer NOT NULL CHECK (minimum_cell_size BETWEEN 1 AND 100000),
  suppressed_record_count bigint NOT NULL DEFAULT 0 CHECK (suppressed_record_count >= 0),
  source_system text NOT NULL CHECK (length(trim(source_system)) BETWEEN 1 AND 160),
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE (exchange_job_id)
);

ALTER TABLE interoperability_exchange_jobs
  ADD CONSTRAINT interoperability_exchange_jobs_profile_fk
  FOREIGN KEY (organization_id, integration_profile_id)
  REFERENCES integration_profiles(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE interoperability_exchange_jobs
  ADD CONSTRAINT interoperability_exchange_jobs_programme_fk
  FOREIGN KEY (organization_id, programme_code)
  REFERENCES programmes(organization_id, code) ON DELETE RESTRICT;

CREATE INDEX interoperability_exchange_envelopes_org_idx
  ON interoperability_exchange_envelopes(organization_id, provider, format, created_at DESC);

ALTER TABLE interoperability_exchange_envelopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY interoperability_exchange_envelopes_tenant
  ON interoperability_exchange_envelopes
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

CREATE OR REPLACE FUNCTION prevent_interoperability_envelope_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'interoperability exchange envelopes are append-only';
END;
$$;

CREATE TRIGGER interoperability_exchange_envelope_append_only
BEFORE UPDATE OR DELETE ON interoperability_exchange_envelopes
FOR EACH ROW EXECUTE FUNCTION prevent_interoperability_envelope_mutation();

COMMENT ON TABLE interoperability_exchange_envelopes IS
  'Provider-neutral, versioned evidence envelope for future DHIS2/FHIR/CSV exchange. It records what would be exchanged and its privacy boundary; it is not proof of external transfer.';

COMMIT;
