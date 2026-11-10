-- Outcome root-cause learning: preserve competing explanations and explainable recurrence clustering.
-- This does not assert causality; hypotheses remain reviewable evidence records.
BEGIN;

CREATE TABLE recurrence_cluster_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  recurrence_pattern_id uuid NOT NULL,
  classification text NOT NULL CHECK (classification IN ('isolated','emerging','persistent')),
  occurrence_count integer NOT NULL CHECK (occurrence_count >= 1),
  unresolved_occurrences integer NOT NULL CHECK (unresolved_occurrences >= 0),
  recurrence_after_action integer NOT NULL CHECK (recurrence_after_action >= 0),
  similarity_threshold numeric(5,4) NOT NULL CHECK (similarity_threshold BETWEEN 0 AND 1),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  assessed_by uuid NOT NULL,
  explanation text NOT NULL CHECK (length(trim(explanation)) BETWEEN 5 AND 3000),
  FOREIGN KEY (organization_id, recurrence_pattern_id) REFERENCES recurrence_patterns(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);
CREATE INDEX recurrence_cluster_assessments_lookup_idx ON recurrence_cluster_assessments(organization_id, recurrence_pattern_id, assessed_at DESC);

CREATE TABLE root_cause_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid,
  recurrence_pattern_id uuid,
  mechanism text NOT NULL CHECK (mechanism IN ('resource_constraint','workflow_failure','access_barrier','service_capacity','information_gap','coordination_failure','environmental_factor','behavioural_context','policy_or_governance','other')),
  problem_statement text NOT NULL CHECK (length(trim(problem_statement)) BETWEEN 10 AND 2000),
  hypothesis text NOT NULL CHECK (length(trim(hypothesis)) BETWEEN 10 AND 3000),
  supporting_evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(supporting_evidence)='array' AND jsonb_array_length(supporting_evidence) <= 20),
  disconfirming_evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(disconfirming_evidence)='array' AND jsonb_array_length(disconfirming_evidence) <= 20),
  context_tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(context_tags)='array' AND jsonb_array_length(context_tags) <= 30),
  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  status text NOT NULL CHECK (status IN ('candidate','under_review','supported','not_supported','superseded')),
  proposed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, recurrence_pattern_id) REFERENCES recurrence_patterns(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id),
  CHECK (signal_id IS NOT NULL OR recurrence_pattern_id IS NOT NULL)
);
CREATE INDEX root_cause_hypotheses_lookup_idx ON root_cause_hypotheses(organization_id, status, confidence, created_at DESC);

CREATE TABLE root_cause_hypothesis_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  hypothesis_id uuid NOT NULL,
  reviewer_user_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('supported','not_supported','needs_more_evidence','superseded')),
  rationale text NOT NULL CHECK (length(trim(rationale)) BETWEEN 10 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, hypothesis_id) REFERENCES root_cause_hypotheses(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);
CREATE INDEX root_cause_reviews_lookup_idx ON root_cause_hypothesis_reviews(organization_id, hypothesis_id, created_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['recurrence_cluster_assessments','root_cause_hypotheses','root_cause_hypothesis_reviews'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',t);
  END LOOP;
END $$;

CREATE FUNCTION reject_outcome_root_cause_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'outcome root-cause learning records are append-only' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER recurrence_cluster_assessments_no_update BEFORE UPDATE OR DELETE ON recurrence_cluster_assessments FOR EACH ROW EXECUTE FUNCTION reject_outcome_root_cause_mutation();
CREATE TRIGGER root_cause_hypotheses_no_update BEFORE UPDATE OR DELETE ON root_cause_hypotheses FOR EACH ROW EXECUTE FUNCTION reject_outcome_root_cause_mutation();
CREATE TRIGGER root_cause_reviews_no_update BEFORE UPDATE OR DELETE ON root_cause_hypothesis_reviews FOR EACH ROW EXECUTE FUNCTION reject_outcome_root_cause_mutation();

COMMIT;
