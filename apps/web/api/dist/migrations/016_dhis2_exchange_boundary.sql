-- Phase 7C: verified external exchange boundary.
-- This creates job/receipt state only. No external HTTP request is performed by the migration.
BEGIN;

ALTER TABLE country_indicator_mappings
  ADD COLUMN mapping_version text NOT NULL DEFAULT '1' CHECK (length(trim(mapping_version)) BETWEEN 1 AND 80);

CREATE TABLE administrative_unit_mappings (
  country_code char(2) NOT NULL REFERENCES country_configs(country_code) ON DELETE RESTRICT,
  level integer NOT NULL CHECK (level BETWEEN 0 AND 10),
  local_code text NOT NULL CHECK (length(trim(local_code)) BETWEEN 1 AND 120),
  external_code text NOT NULL CHECK (length(trim(external_code)) BETWEEN 1 AND 120),
  mapping_version text NOT NULL CHECK (length(trim(mapping_version)) BETWEEN 1 AND 80),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_code, level, local_code, mapping_version)
);
CREATE INDEX administrative_unit_mappings_lookup_idx ON administrative_unit_mappings(country_code, level, external_code, active);

CREATE TABLE interoperability_exchange_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  integration_profile_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('dhis2','fhir','csv','other')),
  direction text NOT NULL CHECK (direction IN ('import','export')),
  mode text NOT NULL CHECK (mode IN ('metadata','aggregate_data')),
  country_code char(2) NOT NULL REFERENCES country_configs(country_code) ON DELETE RESTRICT,
  programme_code text,
  indicator_codes jsonb NOT NULL CHECK (jsonb_typeof(indicator_codes) = 'array'),
  mapping_version text NOT NULL CHECK (length(trim(mapping_version)) BETWEEN 1 AND 80),
  administrative_unit_mapping_version text CHECK (administrative_unit_mapping_version IS NULL OR length(trim(administrative_unit_mapping_version)) BETWEEN 1 AND 80),
  purpose text NOT NULL CHECK (length(trim(purpose)) BETWEEN 3 AND 500),
  cross_border boolean NOT NULL DEFAULT false,
  idempotency_key text NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 200),
  contract_fingerprint text NOT NULL CHECK (length(trim(contract_fingerprint)) BETWEEN 1 AND 2000),
  status text NOT NULL CHECK (status IN ('queued','running','succeeded','failed','rejected','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
  next_attempt_at timestamptz,
  last_error_code text CHECK (last_error_code IS NULL OR length(trim(last_error_code)) BETWEEN 1 AND 120),
  rejection_code text CHECK (rejection_code IS NULL OR rejection_code IN ('policy_missing','policy_inactive','indicator_not_allowed','cross_border_not_allowed','profile_missing','profile_not_verified','capability_missing','country_mismatch','programme_mismatch','mapping_missing','contract_invalid','transport_disabled')),
  external_reference text,
  error_code text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX interoperability_exchange_jobs_org_status_idx ON interoperability_exchange_jobs(organization_id, status, created_at DESC);
CREATE INDEX interoperability_exchange_jobs_profile_idx ON interoperability_exchange_jobs(organization_id, integration_profile_id, created_at DESC);

CREATE TABLE interoperability_exchange_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  exchange_job_id uuid NOT NULL REFERENCES interoperability_exchange_jobs(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('accepted','rejected','completed','failed')),
  provider text NOT NULL CHECK (provider IN ('dhis2','fhir','csv','other')),
  contract_version text NOT NULL CHECK (contract_version = '1.0'),
  idempotency_key text NOT NULL,
  external_reference text,
  message text CHECK (message IS NULL OR length(message) <= 500),
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exchange_job_id)
);

ALTER TABLE administrative_unit_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE interoperability_exchange_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE interoperability_exchange_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY administrative_unit_mappings_read ON administrative_unit_mappings
  FOR SELECT USING (active = true);

CREATE POLICY interoperability_exchange_jobs_tenant ON interoperability_exchange_jobs
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY interoperability_exchange_receipts_tenant ON interoperability_exchange_receipts
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

COMMENT ON TABLE interoperability_exchange_jobs IS 'Exchange state and authorization evidence. A queued/succeeded job is not proof of a real external transfer unless a verified transport adapter records a receipt.';
COMMENT ON TABLE interoperability_exchange_receipts IS 'Immutable-ish exchange receipt surface. External references are provider responses, not credentials.';

COMMIT;
