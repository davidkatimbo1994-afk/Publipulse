-- Persist transparent workflow-gap findings for review and audit. A detection is not a diagnosis or outbreak declaration.
BEGIN;

CREATE TABLE action_gap_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid NOT NULL,
  rule_code text NOT NULL CHECK (rule_code IN ('UNVERIFIED','NO_OWNER','OVERDUE','BLOCKED','NO_EVIDENCE','REPEATED','LOW_CONFIDENCE','RESOURCE_DECISION_MISSING','HANDOFF_STALLED','RECENTLY_REOPENED','CROSS_FACILITY_PATTERN')),
  rule_version text NOT NULL DEFAULT '1.0.0' CHECK (length(trim(rule_version)) BETWEEN 1 AND 40),
  severity text NOT NULL CHECK (severity IN ('urgent','high','watch','clear')),
  explanation text NOT NULL CHECK (length(trim(explanation)) BETWEEN 3 AND 2000),
  supporting_evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(supporting_evidence) = 'object'),
  recommended_next_step text NOT NULL CHECK (length(trim(recommended_next_step)) BETWEEN 3 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','dismissed','resolved')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text CHECK (review_note IS NULL OR length(review_note) <= 2000),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id, id) ON DELETE RESTRICT,
  CHECK ((status = 'open' AND reviewed_at IS NULL) OR status <> 'open'),
  UNIQUE (organization_id, signal_id, rule_code, rule_version, detected_at)
);

CREATE INDEX action_gap_org_status_detected_idx ON action_gap_detections (organization_id, status, detected_at DESC);
CREATE INDEX action_gap_signal_detected_idx ON action_gap_detections (organization_id, signal_id, detected_at DESC);
ALTER TABLE action_gap_detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON action_gap_detections
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

COMMIT;
