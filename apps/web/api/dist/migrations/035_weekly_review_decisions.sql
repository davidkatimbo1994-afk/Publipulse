-- Append-only district/programme weekly decision evidence.
BEGIN;

CREATE TABLE weekly_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  week_start timestamptz NOT NULL,
  week_end timestamptz NOT NULL,
  administrative_area_code text NOT NULL CHECK (length(trim(administrative_area_code)) BETWEEN 1 AND 80 AND administrative_area_code ~ '^[A-Za-z0-9._-]+$'),
  agenda_code text NOT NULL CHECK (agenda_code IN ('ownership_gap','unresolved_outcome','recurrence','response_blocker','intervention_resistant','feedback_gap','integration_gap')),
  decision text NOT NULL CHECK (decision IN ('continue_current_approach','change_approach','escalate_programme_redesign','insufficient_evidence')),
  rationale text NOT NULL CHECK (length(trim(rationale)) BETWEEN 10 AND 2000),
  next_check_at timestamptz NOT NULL,
  owner_role text NOT NULL CHECK (owner_role IN ('programme_lead','district_lead','surveillance_lead','response_lead','laboratory_lead','other')),
  evidence_digest text CHECK (evidence_digest IS NULL OR length(trim(evidence_digest)) BETWEEN 16 AND 128),
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (week_start < week_end),
  CHECK (week_end - week_start <= interval '31 days'),
  CHECK (next_check_at >= week_end),
  UNIQUE (organization_id, week_start, week_end, administrative_area_code, agenda_code, decided_at)
);

CREATE INDEX weekly_review_decisions_org_time_idx ON weekly_review_decisions(organization_id, week_start DESC, decided_at DESC);

ALTER TABLE weekly_review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_review_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY weekly_review_decisions_tenant_policy ON weekly_review_decisions
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

REVOKE UPDATE, DELETE ON weekly_review_decisions FROM PUBLIC;

CREATE OR REPLACE FUNCTION reject_weekly_review_decision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'weekly review decisions are append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER weekly_review_decisions_no_update
  BEFORE UPDATE OR DELETE ON weekly_review_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_weekly_review_decision_mutation();

COMMIT;
