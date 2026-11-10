-- Operational clocks: explicit notification/response-start evidence for 7-1-7-aligned reporting.
-- These are workflow timestamps, not clinical or causal measures.
BEGIN;
CREATE INDEX IF NOT EXISTS audit_signal_milestone_idx
  ON audit_events(organization_id, resource_id, action, occurred_at)
  WHERE resource_type = 'signal' AND action IN ('signal.notified','signal.response_started');
COMMIT;
