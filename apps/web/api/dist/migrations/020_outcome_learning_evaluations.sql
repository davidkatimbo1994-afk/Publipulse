-- Outcome learning evaluations: preserve the review queue and test whether expert-suggested
-- interventions actually produced durable improvement. Records are append-only evidence.
BEGIN;

CREATE TABLE outcome_review_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid NOT NULL,
  outcome_id uuid,
  reason text NOT NULL CHECK (reason IN ('closed_without_resolution','outcome_not_measured','recurring_after_action','outcome_worsened','outcome_inconclusive')),
  priority text NOT NULL CHECK (priority IN ('critical','high','watch')),
  requires_reopening boolean NOT NULL,
  requires_expert_review boolean NOT NULL,
  next_step text NOT NULL CHECK (length(trim(next_step)) BETWEEN 5 AND 2000),
  generated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, outcome_id) REFERENCES outcomes(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);
CREATE INDEX outcome_review_tasks_org_priority_idx ON outcome_review_tasks(organization_id, priority, generated_at DESC);
CREATE INDEX outcome_review_tasks_signal_idx ON outcome_review_tasks(organization_id, signal_id, generated_at DESC);

CREATE TABLE expert_recommendation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  recommendation_id uuid NOT NULL,
  reviewer_user_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accepted','rejected','needs_more_evidence','superseded')),
  rationale text NOT NULL CHECK (length(trim(rationale)) BETWEEN 10 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, recommendation_id) REFERENCES expert_recommendations(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);
CREATE INDEX expert_recommendation_reviews_lookup_idx ON expert_recommendation_reviews(organization_id, recommendation_id, created_at DESC);

CREATE TABLE intervention_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  recommendation_id uuid NOT NULL,
  signal_id uuid NOT NULL,
  outcome_id uuid,
  observed_result text NOT NULL CHECK (observed_result IN ('improved','no_change','worsened','inconclusive')),
  evidence_sufficient boolean NOT NULL DEFAULT false,
  recurrence_after_intervention integer NOT NULL DEFAULT 0 CHECK (recurrence_after_intervention >= 0),
  learning_classification text NOT NULL CHECK (learning_classification IN ('supported','mixed','not_supported','insufficient_evidence')),
  evidence_summary text NOT NULL CHECK (length(trim(evidence_summary)) BETWEEN 5 AND 3000),
  evaluated_by uuid NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, recommendation_id) REFERENCES expert_recommendations(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, outcome_id) REFERENCES outcomes(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);
CREATE INDEX intervention_evaluations_learning_idx ON intervention_evaluations(organization_id, learning_classification, evaluated_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['outcome_review_tasks','expert_recommendation_reviews','intervention_evaluations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',t);
  END LOOP;
END $$;

CREATE FUNCTION reject_outcome_learning_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'outcome learning records are append-only' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER outcome_review_tasks_no_update BEFORE UPDATE OR DELETE ON outcome_review_tasks FOR EACH ROW EXECUTE FUNCTION reject_outcome_learning_mutation();
CREATE TRIGGER expert_recommendation_reviews_no_update BEFORE UPDATE OR DELETE ON expert_recommendation_reviews FOR EACH ROW EXECUTE FUNCTION reject_outcome_learning_mutation();
CREATE TRIGGER intervention_evaluations_no_update BEFORE UPDATE OR DELETE ON intervention_evaluations FOR EACH ROW EXECUTE FUNCTION reject_outcome_learning_mutation();

COMMIT;
