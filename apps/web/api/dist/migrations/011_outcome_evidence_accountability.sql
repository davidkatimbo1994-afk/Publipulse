-- Extend outcome measurements with explicit targets, evidence provenance, and uncertainty.
-- Existing rows remain valid; new API contracts require evidence source and a stated result.
BEGIN;

ALTER TABLE outcomes
  ADD COLUMN target_value numeric,
  ADD COLUMN assessment_result text,
  ADD COLUMN evidence_source text,
  ADD COLUMN uncertainty_note text,
  ADD COLUMN assessment_method text;

ALTER TABLE outcomes
  ADD CONSTRAINT outcomes_assessment_result_check
    CHECK (assessment_result IS NULL OR assessment_result IN ('improved','no_change','worsened','inconclusive')),
  ADD CONSTRAINT outcomes_evidence_source_length_check
    CHECK (evidence_source IS NULL OR length(trim(evidence_source)) BETWEEN 1 AND 240),
  ADD CONSTRAINT outcomes_uncertainty_note_length_check
    CHECK (uncertainty_note IS NULL OR length(uncertainty_note) <= 3000),
  ADD CONSTRAINT outcomes_assessment_method_length_check
    CHECK (assessment_method IS NULL OR length(trim(assessment_method)) BETWEEN 3 AND 1000);

CREATE INDEX outcomes_org_action_measured_idx
  ON outcomes (organization_id, action_id, measured_at DESC);
CREATE INDEX outcomes_org_indicator_measured_idx
  ON outcomes (organization_id, indicator_code, measured_at DESC);

COMMIT;
