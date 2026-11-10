-- Phase 7F: DHIS2 metadata and organisation-unit mapping evidence.
-- This migration stores versioned mapping declarations only; it does not contact DHIS2.
BEGIN;

CREATE TABLE dhis2_indicator_mappings (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  country_code char(2) NOT NULL REFERENCES country_configs(country_code) ON DELETE RESTRICT,
  publipulse_indicator_code text NOT NULL,
  dhis2_data_element_uid text NOT NULL CHECK (dhis2_data_element_uid ~ '^[A-Za-z0-9]{11}$'),
  mapping_version text NOT NULL CHECK (length(trim(mapping_version)) BETWEEN 1 AND 80),
  expected_value_type text,
  expected_aggregation_type text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  PRIMARY KEY (organization_id, country_code, publipulse_indicator_code, mapping_version)
);
CREATE INDEX dhis2_indicator_mappings_lookup_idx ON dhis2_indicator_mappings(organization_id, country_code, dhis2_data_element_uid, active);

CREATE TABLE dhis2_org_unit_mappings (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  country_code char(2) NOT NULL REFERENCES country_configs(country_code) ON DELETE RESTRICT,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 10),
  local_code text NOT NULL CHECK (length(trim(local_code)) BETWEEN 1 AND 120),
  dhis2_organisation_unit_uid text NOT NULL CHECK (dhis2_organisation_unit_uid ~ '^[A-Za-z0-9]{11}$'),
  mapping_version text NOT NULL CHECK (length(trim(mapping_version)) BETWEEN 1 AND 80),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  PRIMARY KEY (organization_id, country_code, level, local_code, mapping_version)
);
CREATE INDEX dhis2_org_unit_mappings_lookup_idx ON dhis2_org_unit_mappings(organization_id, country_code, level, dhis2_organisation_unit_uid, active);

CREATE TABLE dhis2_metadata_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  integration_profile_id uuid NOT NULL,
  country_code char(2) NOT NULL REFERENCES country_configs(country_code) ON DELETE RESTRICT,
  mapping_version text NOT NULL,
  metadata_instance_version text,
  metadata_digest text NOT NULL CHECK (length(trim(metadata_digest)) BETWEEN 16 AND 200),
  status text NOT NULL CHECK (status IN ('aligned','drift_detected','invalid_snapshot')),
  checked_indicator_count integer NOT NULL CHECK (checked_indicator_count >= 0),
  checked_org_unit_count integer NOT NULL CHECK (checked_org_unit_count >= 0),
  drift_count integer NOT NULL CHECK (drift_count >= 0),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  evaluated_by uuid NOT NULL
);
CREATE INDEX dhis2_metadata_reconciliation_org_idx ON dhis2_metadata_reconciliation_runs(organization_id, country_code, evaluated_at DESC);

ALTER TABLE dhis2_indicator_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dhis2_org_unit_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dhis2_metadata_reconciliation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY dhis2_indicator_mappings_tenant ON dhis2_indicator_mappings
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY dhis2_org_unit_mappings_tenant ON dhis2_org_unit_mappings
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY dhis2_metadata_reconciliation_tenant ON dhis2_metadata_reconciliation_runs
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

COMMENT ON TABLE dhis2_indicator_mappings IS 'Versioned PubliPulse-to-DHIS2 indicator mapping declarations; not proof of live connectivity.';
COMMENT ON TABLE dhis2_org_unit_mappings IS 'Versioned country administrative-unit to DHIS2 organisation-unit mappings.';
COMMENT ON TABLE dhis2_metadata_reconciliation_runs IS 'Evidence of comparing a DHIS2 metadata snapshot against approved mappings; drift blocks automatic exchange until reviewed.';

COMMIT;
