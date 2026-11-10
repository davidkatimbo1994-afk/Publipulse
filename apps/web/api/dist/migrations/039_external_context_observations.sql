-- Append-only external context (rainfall, water access, prices, ...) per administrative area and period, with provenance.
BEGIN;

CREATE TABLE external_context_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  client_mutation_id text,
  administrative_area_code text NOT NULL CHECK (length(trim(administrative_area_code)) BETWEEN 1 AND 80 AND administrative_area_code ~ '^[A-Za-z0-9._-]+$'),
  metric_code text NOT NULL CHECK (length(trim(metric_code)) BETWEEN 1 AND 80 AND metric_code ~ '^[a-z0-9_.-]+$'),
  value numeric(18,4) NOT NULL CHECK (value > -1000000000000 AND value < 1000000000000),
  unit text NOT NULL CHECK (length(trim(unit)) BETWEEN 1 AND 40),
  period_start date NOT NULL,
  period_end date NOT NULL,
  source_label text NOT NULL CHECK (length(trim(source_label)) BETWEEN 1 AND 240),
  source_uri text CHECK (source_uri IS NULL OR (length(source_uri) <= 2048 AND source_uri ~ '^https://[^@\s]+$')),
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_start <= period_end),
  CHECK (period_end - period_start <= 31),
  CHECK (client_mutation_id IS NULL OR client_mutation_id ~ '^[A-Za-z0-9._:-]{16,128}$'),
  UNIQUE (organization_id, id)
);

CREATE UNIQUE INDEX external_context_org_mutation_uidx
  ON external_context_observations(organization_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE INDEX external_context_area_metric_idx
  ON external_context_observations(organization_id, administrative_area_code, metric_code, period_end DESC);

ALTER TABLE external_context_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_context_observations FORCE ROW LEVEL SECURITY;
CREATE POLICY external_context_observations_tenant_policy ON external_context_observations
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

REVOKE UPDATE, DELETE ON external_context_observations FROM PUBLIC;

CREATE OR REPLACE FUNCTION reject_external_context_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'external context observations are append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER external_context_observations_no_update
  BEFORE UPDATE OR DELETE ON external_context_observations
  FOR EACH ROW EXECUTE FUNCTION reject_external_context_mutation();

COMMIT;
