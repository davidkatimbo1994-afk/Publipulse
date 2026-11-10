-- Phase 7: African-scale interoperability and governance foundations.
-- This migration defines metadata/configuration boundaries only.
-- It does NOT establish a live DHIS2/FHIR integration or claim external verification.
BEGIN;

CREATE TABLE country_configs (
  country_code char(2) PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  default_language text NOT NULL CHECK (length(trim(default_language)) BETWEEN 2 AND 40),
  timezone text NOT NULL CHECK (length(trim(timezone)) BETWEEN 1 AND 80),
  administrative_levels jsonb NOT NULL CHECK (jsonb_typeof(administrative_levels) = 'array'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  country_code char(2) NOT NULL REFERENCES country_configs(country_code) ON DELETE RESTRICT,
  code text NOT NULL CHECK (length(trim(code)) BETWEEN 2 AND 80),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  status text NOT NULL CHECK (status IN ('draft','active','suspended','retired')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, id)
);
CREATE INDEX programmes_org_country_status_idx ON programmes(organization_id, country_code, status);

CREATE TABLE organization_programmes (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  programme_id uuid NOT NULL REFERENCES programmes(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, programme_id)
);

CREATE TABLE indicator_definitions (
  code text PRIMARY KEY CHECK (length(trim(code)) BETWEEN 1 AND 120),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 240),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 2000),
  unit text CHECK (unit IS NULL OR length(unit) <= 80),
  aggregation text NOT NULL CHECK (aggregation IN ('count','rate','ratio','proportion','percentage','index','other')),
  numerator_definition text CHECK (numerator_definition IS NULL OR length(numerator_definition) <= 2000),
  denominator_definition text CHECK (denominator_definition IS NULL OR length(denominator_definition) <= 2000),
  source_standard text CHECK (source_standard IS NULL OR length(source_standard) <= 240),
  standard_version text CHECK (standard_version IS NULL OR length(standard_version) <= 80),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE country_indicator_mappings (
  country_code char(2) NOT NULL REFERENCES country_configs(country_code) ON DELETE RESTRICT,
  indicator_code text NOT NULL REFERENCES indicator_definitions(code) ON DELETE RESTRICT,
  local_code text CHECK (local_code IS NULL OR length(trim(local_code)) BETWEEN 1 AND 120),
  local_label text CHECK (local_label IS NULL OR length(trim(local_label)) BETWEEN 1 AND 240),
  denominator_note text CHECK (denominator_note IS NULL OR length(denominator_note) <= 1000),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (country_code, indicator_code)
);

CREATE TABLE data_sharing_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  programme_id uuid,
  classification text NOT NULL CHECK (classification IN ('aggregate','operational','sensitive')),
  purpose text NOT NULL CHECK (length(trim(purpose)) BETWEEN 3 AND 500),
  destination_type text NOT NULL CHECK (destination_type IN ('same_organization','authorized_programme','authorized_country_system','external_system')),
  allowed_indicator_codes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(allowed_indicator_codes) = 'array'),
  minimum_cell_size integer NOT NULL DEFAULT 5 CHECK (minimum_cell_size BETWEEN 1 AND 100000),
  allow_cross_border boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, programme_id) REFERENCES programmes(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX data_sharing_policies_org_active_idx ON data_sharing_policies(organization_id, active, created_at DESC);

CREATE TABLE integration_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('dhis2','csv','fhir','other')),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  status text NOT NULL CHECK (status IN ('planned','configured','verification_pending','verified','disabled')),
  base_url text CHECK (base_url IS NULL OR (base_url ~ '^https://[^[:space:]]+$' AND length(base_url) <= 2048)),
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);
CREATE INDEX integration_profiles_org_provider_idx ON integration_profiles(organization_id, provider, status);

ALTER TABLE country_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicator_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_indicator_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sharing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY country_configs_read ON country_configs
  FOR SELECT USING (active = true);
CREATE POLICY programmes_tenant ON programmes
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY organization_programmes_tenant ON organization_programmes
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY indicator_definitions_read ON indicator_definitions
  FOR SELECT USING (active = true);
CREATE POLICY country_indicator_mappings_read ON country_indicator_mappings
  FOR SELECT USING (active = true);
CREATE POLICY data_sharing_policies_tenant ON data_sharing_policies
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY integration_profiles_tenant ON integration_profiles
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

-- Configuration/registry metadata is not an integration credential store.
COMMENT ON TABLE integration_profiles IS 'Interoperability metadata only. Secrets, tokens, and credentials must be stored outside this database.';
COMMENT ON TABLE data_sharing_policies IS 'Explicit tenant-scoped sharing boundaries. A policy does not authorize a transfer by itself; enforcement remains required at every exchange path.';

COMMIT;
