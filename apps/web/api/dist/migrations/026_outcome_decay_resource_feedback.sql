-- Outcome-first operational intelligence: response decay, normalized blockers,
-- bounded reporter feedback, and append-only learning decisions.
BEGIN;

ALTER TABLE response_actions
  ADD COLUMN blocker_type text CHECK (blocker_type IS NULL OR blocker_type IN ('supplies','transport','laboratory','authorization','staffing','funding','coordination','information','infrastructure','other'));

ALTER TABLE expert_recommendations
  ADD COLUMN intervention_family text CHECK (intervention_family IS NULL OR intervention_family IN ('service_delivery','supplies','transport','laboratory','staffing','community_engagement','coordination','policy_or_governance','infrastructure','information','other'));

CREATE INDEX expert_recommendations_intervention_family_idx ON expert_recommendations(organization_id, recurrence_pattern_id, intervention_family, created_at DESC);

CREATE INDEX response_actions_org_blocker_idx
  ON response_actions(organization_id, blocker_type, status, updated_at DESC);

CREATE TABLE reporter_feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('community_report','facility_report','field_observation','research','other')),
  feedback_stage text NOT NULL CHECK (feedback_stage IN ('received','under_review','action_underway','follow_up_done','outcome_recorded')),
  delivery_channel text NOT NULL CHECK (delivery_channel IN ('sms','ussd','offline_sync','other')),
  delivery_status text NOT NULL CHECK (delivery_status IN ('queued','sent','delivered','failed','not_attempted')),
  delivered_at timestamptz,
  non_identifying_message text NOT NULL CHECK (length(trim(non_identifying_message)) BETWEEN 3 AND 500),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id,id) ON DELETE RESTRICT,
  CHECK (delivery_status <> 'delivered' OR delivered_at IS NOT NULL),
  CHECK (delivery_status <> 'not_attempted' OR delivered_at IS NULL),
  UNIQUE (organization_id, id)
);
CREATE INDEX reporter_feedback_org_signal_idx ON reporter_feedback_events(organization_id, signal_id, created_at DESC);

CREATE TABLE persistent_problem_learning_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  recurrence_pattern_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('continue_current_approach','change_approach','escalate_programme_redesign','insufficient_evidence')),
  rationale text NOT NULL CHECK (length(trim(rationale)) BETWEEN 10 AND 3000),
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_references)='array' AND jsonb_array_length(evidence_references) <= 20),
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, recurrence_pattern_id) REFERENCES recurrence_patterns(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);
CREATE INDEX persistent_problem_learning_decisions_idx ON persistent_problem_learning_decisions(organization_id, recurrence_pattern_id, decided_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['reporter_feedback_events','persistent_problem_learning_decisions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION reject_outcome_operations_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'outcome operations evidence is append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER reporter_feedback_no_update BEFORE UPDATE OR DELETE ON reporter_feedback_events FOR EACH ROW EXECUTE FUNCTION reject_outcome_operations_mutation();
CREATE TRIGGER persistent_problem_learning_decisions_no_update BEFORE UPDATE OR DELETE ON persistent_problem_learning_decisions FOR EACH ROW EXECUTE FUNCTION reject_outcome_operations_mutation();

COMMIT;
