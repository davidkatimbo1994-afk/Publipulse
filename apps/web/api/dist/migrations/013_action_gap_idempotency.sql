-- Enforce idempotency for evaluator findings while preserving human review state.
BEGIN;

ALTER TABLE action_gap_detections
  ADD COLUMN fingerprint text;

-- Existing manually created detections remain distinct; evaluator-generated
-- records supply a stable fingerprint on future writes.
CREATE UNIQUE INDEX action_gap_org_fingerprint_uidx
  ON action_gap_detections (organization_id, fingerprint)
  WHERE fingerprint IS NOT NULL;

CREATE INDEX action_gap_org_rule_detected_idx
  ON action_gap_detections (organization_id, rule_code, rule_version, detected_at DESC);

COMMIT;
