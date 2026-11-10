-- Controlled data-lifecycle review. No automatic deletion is authorized by this migration.
-- A legal/operational hold always wins over retention eligibility.
BEGIN;

CREATE TABLE data_retention_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  data_class text NOT NULL CHECK (data_class IN ('operational','outcome_evidence','interoperability_evidence','audit')),
  scope_key text NOT NULL CHECK (length(trim(scope_key)) BETWEEN 1 AND 160),
  reason_code text NOT NULL CHECK (reason_code IN ('legal_hold','investigation','governance_review','security_incident','other')),
  note text CHECK (note IS NULL OR length(note) <= 2000),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_by uuid,
  released_at timestamptz,
  CHECK ((active AND released_at IS NULL) OR (NOT active AND released_at IS NOT NULL)),
  UNIQUE (organization_id, data_class, scope_key)
);
CREATE INDEX data_retention_holds_active_idx ON data_retention_holds(organization_id, data_class, active);

CREATE TABLE data_disposition_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  data_class text NOT NULL CHECK (data_class IN ('operational','outcome_evidence','interoperability_evidence','audit')),
  scope_key text NOT NULL CHECK (length(trim(scope_key)) BETWEEN 1 AND 160),
  cutoff_at timestamptz NOT NULL,
  candidate_count integer NOT NULL CHECK (candidate_count >= 0),
  disposition text NOT NULL CHECK (disposition IN ('retain','eligible_for_review','held','approved_for_disposition')),
  rationale text NOT NULL CHECK (length(trim(rationale)) BETWEEN 5 AND 2000),
  reviewed_by uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);
CREATE INDEX data_disposition_reviews_lookup_idx ON data_disposition_reviews(organization_id, data_class, scope_key, reviewed_at DESC);

ALTER TABLE data_retention_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_holds FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON data_retention_holds
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE data_disposition_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_disposition_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON data_disposition_reviews
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

-- Disposition evidence is append-only. Actual deletion remains a separate privileged,
-- reviewed operation with legal-hold, backup, and governance checks outside this migration.
CREATE OR REPLACE FUNCTION reject_disposition_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'data_disposition_reviews are append-only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER data_disposition_reviews_no_update
BEFORE UPDATE OR DELETE ON data_disposition_reviews
FOR EACH ROW EXECUTE FUNCTION reject_disposition_mutation();

COMMENT ON TABLE data_retention_holds IS
  'Organization-scoped holds that override retention eligibility. A hold never authorizes disclosure or deletion.';
COMMENT ON TABLE data_disposition_reviews IS
  'Append-only evidence that a retention candidate was reviewed. This table does not itself delete data.';

COMMIT;
