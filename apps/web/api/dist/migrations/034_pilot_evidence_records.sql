-- Immutable, tenant-scoped pilot evidence snapshots.
BEGIN;

CREATE TABLE pilot_evidence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120 AND label ~ '^[A-Za-z0-9 _.-]+$'),
  baseline_start timestamptz NOT NULL,
  baseline_end timestamptz NOT NULL,
  pilot_start timestamptz NOT NULL,
  pilot_end timestamptz NOT NULL,
  minimum_cell integer NOT NULL CHECK (minimum_cell BETWEEN 1 AND 1000),
  comparison_snapshot jsonb NOT NULL,
  weekly_decision_change_count integer NOT NULL CHECK (weekly_decision_change_count >= 0),
  offline_sync_incident_count integer NOT NULL CHECK (offline_sync_incident_count >= 0),
  integration_incident_count integer NOT NULL CHECK (integration_incident_count >= 0),
  privacy_incident_count integer NOT NULL CHECK (privacy_incident_count >= 0),
  security_incident_count integer NOT NULL CHECK (security_incident_count >= 0),
  evidence_digest text CHECK (evidence_digest IS NULL OR length(trim(evidence_digest)) BETWEEN 16 AND 128),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, label, baseline_start, baseline_end, pilot_start, pilot_end),
  CHECK (baseline_start < baseline_end),
  CHECK (pilot_start < pilot_end),
  CHECK (baseline_end - baseline_start <= interval '366 days'),
  CHECK (pilot_end - pilot_start <= interval '366 days')
);

CREATE INDEX pilot_evidence_records_org_time_idx ON pilot_evidence_records(organization_id, recorded_at DESC);

ALTER TABLE pilot_evidence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_evidence_records FORCE ROW LEVEL SECURITY;
CREATE POLICY pilot_evidence_records_tenant_policy ON pilot_evidence_records
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

REVOKE UPDATE, DELETE ON pilot_evidence_records FROM PUBLIC;

CREATE OR REPLACE FUNCTION reject_pilot_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'pilot evidence records are append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER pilot_evidence_records_no_update
  BEFORE UPDATE OR DELETE ON pilot_evidence_records
  FOR EACH ROW EXECUTE FUNCTION reject_pilot_evidence_mutation();

COMMIT;
