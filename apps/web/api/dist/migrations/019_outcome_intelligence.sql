-- Outcome intelligence: distinguish administrative closure from evidenced resolution,
-- preserve recurrence patterns, and capture structured expert recommendations.
BEGIN;

CREATE TYPE outcome_case_state AS ENUM ('not_assessed','resolution_unverified','resolved','improved','no_change','worsened','inconclusive','reopened','recurrent');

CREATE TABLE outcome_case_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid NOT NULL,
  action_id uuid,
  state outcome_case_state NOT NULL,
  closure_observed_at timestamptz,
  follow_up_observed_at timestamptz,
  recurrence_count integer NOT NULL DEFAULT 0 CHECK (recurrence_count >= 0),
  evidence_sufficient boolean NOT NULL DEFAULT false,
  explanation text NOT NULL CHECK (length(trim(explanation)) BETWEEN 3 AND 3000),
  assessed_by uuid NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, action_id) REFERENCES response_actions(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);
CREATE INDEX outcome_case_reviews_org_state_idx ON outcome_case_reviews(organization_id,state,assessed_at DESC);
CREATE INDEX outcome_case_reviews_signal_idx ON outcome_case_reviews(organization_id,signal_id,assessed_at DESC);

CREATE TABLE recurrence_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  pattern_key text NOT NULL CHECK (length(trim(pattern_key)) BETWEEN 3 AND 500),
  category text NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 120),
  administrative_area_code text NOT NULL CHECK (length(trim(administrative_area_code)) BETWEEN 1 AND 80),
  window_days integer NOT NULL CHECK (window_days BETWEEN 1 AND 3650),
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count >= 1),
  first_observed_at timestamptz NOT NULL,
  last_observed_at timestamptz NOT NULL,
  unresolved_occurrences integer NOT NULL DEFAULT 0 CHECK (unresolved_occurrences >= 0),
  status text NOT NULL DEFAULT 'observed' CHECK (status IN ('observed','under_review','intervention_planned','monitoring','closed')),
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, pattern_key)
);
CREATE INDEX recurrence_patterns_org_status_idx ON recurrence_patterns(organization_id,status,last_observed_at DESC);

CREATE TABLE expert_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid,
  recurrence_pattern_id uuid,
  contributor_user_id uuid NOT NULL,
  problem_statement text NOT NULL CHECK (length(trim(problem_statement)) BETWEEN 10 AND 2000),
  proposed_intervention text NOT NULL CHECK (length(trim(proposed_intervention)) BETWEEN 10 AND 3000),
  rationale text NOT NULL CHECK (length(trim(rationale)) BETWEEN 10 AND 3000),
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_references)='array' AND jsonb_array_length(evidence_references) <= 20),
  context_tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(context_tags)='array' AND jsonb_array_length(context_tags) <= 30),
  confidence text NOT NULL CHECK (confidence IN ('low','moderate','high')),
  review_status text NOT NULL DEFAULT 'submitted' CHECK (review_status IN ('submitted','accepted','rejected','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, recurrence_pattern_id) REFERENCES recurrence_patterns(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (organization_id,id),
  CHECK (signal_id IS NOT NULL OR recurrence_pattern_id IS NOT NULL)
);
CREATE INDEX expert_recommendations_org_status_idx ON expert_recommendations(organization_id,review_status,created_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['outcome_case_reviews','recurrence_patterns','expert_recommendations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',t);
  END LOOP;
END $$;

-- Outcome review and expert recommendation history must remain auditable.
CREATE FUNCTION reject_outcome_intelligence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'outcome intelligence records are append-only' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER outcome_case_reviews_no_update BEFORE UPDATE OR DELETE ON outcome_case_reviews FOR EACH ROW EXECUTE FUNCTION reject_outcome_intelligence_mutation();
CREATE TRIGGER expert_recommendations_no_update BEFORE UPDATE OR DELETE ON expert_recommendations FOR EACH ROW EXECUTE FUNCTION reject_outcome_intelligence_mutation();

COMMIT;
