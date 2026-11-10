-- Enforce same-signal relationships in the database, not only in API code.
-- Apply after migrations 001, 002, and 003.
BEGIN;

ALTER TABLE investigations
  ADD CONSTRAINT investigations_org_signal_id_unique UNIQUE (organization_id, signal_id, id);

ALTER TABLE decisions
  ADD CONSTRAINT decisions_org_signal_id_unique UNIQUE (organization_id, signal_id, id),
  ADD CONSTRAINT decisions_investigation_same_signal_fk
    FOREIGN KEY (organization_id, signal_id, investigation_id)
    REFERENCES investigations (organization_id, signal_id, id) ON DELETE RESTRICT;

ALTER TABLE response_actions
  ADD CONSTRAINT response_actions_org_signal_id_unique UNIQUE (organization_id, signal_id, id),
  ADD CONSTRAINT response_actions_decision_same_signal_fk
    FOREIGN KEY (organization_id, signal_id, decision_id)
    REFERENCES decisions (organization_id, signal_id, id) ON DELETE RESTRICT;

ALTER TABLE outcomes
  ADD CONSTRAINT outcomes_action_same_signal_fk
    FOREIGN KEY (organization_id, signal_id, action_id)
    REFERENCES response_actions (organization_id, signal_id, id) ON DELETE RESTRICT;

COMMIT;
