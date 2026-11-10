-- Outcome effectiveness learning: compare interventions over repeated evaluations and
-- preserve persistent-problem assessments without claiming causation.
BEGIN;

CREATE TABLE intervention_learning_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  recommendation_id uuid NOT NULL,
  recurrence_pattern_id uuid,
  evaluation_count integer NOT NULL CHECK (evaluation_count >= 0),
  sufficient_evidence_count integer NOT NULL CHECK (sufficient_evidence_count >= 0),
  improved_count integer NOT NULL CHECK (improved_count >= 0),
  no_change_count integer NOT NULL CHECK (no_change_count >= 0),
  worsened_count integer NOT NULL CHECK (worsened_count >= 0),
  inconclusive_count integer NOT NULL CHECK (inconclusive_count >= 0),
  recurrence_count integer NOT NULL CHECK (recurrence_count >= 0),
  classification text NOT NULL CHECK (classification IN ('supported','mixed','not_supported','insufficient_evidence')),
  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  explanation text NOT NULL CHECK (length(trim(explanation)) BETWEEN 10 AND 3000),
  assessed_by uuid NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, recommendation_id) REFERENCES expert_recommendations(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, recurrence_pattern_id) REFERENCES recurrence_patterns(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id),
  CHECK (sufficient_evidence_count <= evaluation_count),
  CHECK (improved_count + no_change_count + worsened_count <= sufficient_evidence_count)
);
CREATE INDEX intervention_learning_summaries_lookup_idx ON intervention_learning_summaries(organization_id, recommendation_id, assessed_at DESC);
CREATE INDEX intervention_learning_summaries_class_idx ON intervention_learning_summaries(organization_id, classification, confidence, assessed_at DESC);

CREATE TABLE persistent_problem_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  recurrence_pattern_id uuid NOT NULL,
  occurrence_count integer NOT NULL CHECK (occurrence_count >= 1),
  unresolved_count integer NOT NULL CHECK (unresolved_count >= 0),
  recurrence_after_action_count integer NOT NULL CHECK (recurrence_after_action_count >= 0),
  time_span_days integer NOT NULL CHECK (time_span_days >= 0),
  distinct_interventions_tried integer NOT NULL CHECK (distinct_interventions_tried >= 0),
  minimum_occurrences integer NOT NULL CHECK (minimum_occurrences >= 1),
  classification text NOT NULL CHECK (classification IN ('not_established','emerging','persistent','intervention_resistant')),
  explanation text NOT NULL CHECK (length(trim(explanation)) BETWEEN 10 AND 3000),
  assessed_by uuid NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, recurrence_pattern_id) REFERENCES recurrence_patterns(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);
CREATE INDEX persistent_problem_assessments_lookup_idx ON persistent_problem_assessments(organization_id, recurrence_pattern_id, assessed_at DESC);
CREATE INDEX persistent_problem_assessments_class_idx ON persistent_problem_assessments(organization_id, classification, assessed_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['intervention_learning_summaries','persistent_problem_assessments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',t);
  END LOOP;
END $$;

CREATE FUNCTION reject_outcome_effectiveness_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'outcome effectiveness records are append-only' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER intervention_learning_summaries_no_update BEFORE UPDATE OR DELETE ON intervention_learning_summaries FOR EACH ROW EXECUTE FUNCTION reject_outcome_effectiveness_mutation();
CREATE TRIGGER persistent_problem_assessments_no_update BEFORE UPDATE OR DELETE ON persistent_problem_assessments FOR EACH ROW EXECUTE FUNCTION reject_outcome_effectiveness_mutation();

COMMIT;
