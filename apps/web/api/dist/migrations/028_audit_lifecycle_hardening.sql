-- Production data lifecycle hardening.
-- Audit metadata is operational evidence only and must not become a health-data side channel.
-- Retention policies are organization-scoped configuration; enforcement is an operator-controlled job.
BEGIN;

CREATE TABLE data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  data_class text NOT NULL CHECK (data_class IN ('operational','outcome_evidence','interoperability_evidence','audit')),
  retention_days integer NOT NULL CHECK (retention_days BETWEEN 1 AND 36500),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, data_class)
);
CREATE INDEX data_retention_policies_org_active_idx ON data_retention_policies(organization_id, active, data_class);

ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON data_retention_policies
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

-- Reject common direct identifiers in audit metadata. Audit rows remain useful for
-- accountability while avoiding a second path for accidentally storing health data.
CREATE OR REPLACE FUNCTION reject_sensitive_audit_metadata()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  payload text := NEW.metadata::text;
BEGIN
  IF payload ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
     OR payload ~* '(^|[^0-9])\+?[0-9][0-9 .()\-]{7,}[0-9]([^0-9]|$)'
     OR payload ~* '\b(patient|client|person)\s*(id|identifier|number)\s*[:#-]?\s*[A-Z0-9-]{4,}\b'
  THEN
    RAISE EXCEPTION 'audit metadata contains a prohibited direct identifier' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_events_no_common_direct_identifier
BEFORE INSERT OR UPDATE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_sensitive_audit_metadata();

COMMENT ON TABLE data_retention_policies IS
  'Organization-scoped retention policy declarations. Automated enforcement must run as a separate privileged, reviewed operation; policies do not authorize deletion by themselves.';
COMMENT ON FUNCTION reject_sensitive_audit_metadata() IS
  'Defense-in-depth control preventing common direct identifiers from entering audit metadata.';

COMMIT;
