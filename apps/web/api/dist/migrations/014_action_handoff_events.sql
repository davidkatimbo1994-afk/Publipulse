BEGIN;
-- Append-only operational history for transfer of responsibility between authorized users.
CREATE TABLE action_handoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  action_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('initiated','accepted','declined','cancelled')),
  from_user_id uuid,
  to_user_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  note text CHECK (note IS NULL OR length(note) <= 2000),
  recorded_by uuid NOT NULL,
  FOREIGN KEY (organization_id, action_id) REFERENCES response_actions(organization_id, id) ON DELETE RESTRICT,
  CHECK (event_type <> 'initiated' OR to_user_id IS NOT NULL),
  CHECK (event_type <> 'accepted' OR to_user_id IS NOT NULL),
  UNIQUE (organization_id, id)
);
CREATE INDEX action_handoff_events_latest_idx ON action_handoff_events(organization_id, action_id, occurred_at DESC, id DESC);
ALTER TABLE action_handoff_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_handoff_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON action_handoff_events
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
-- Append-only event history: corrections must be new events, not mutation of prior evidence.
CREATE FUNCTION reject_action_handoff_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'action_handoff_events are append-only' USING ERRCODE = '42501'; END;
$$;
CREATE TRIGGER action_handoff_events_no_update BEFORE UPDATE OR DELETE ON action_handoff_events
FOR EACH ROW EXECUTE FUNCTION reject_action_handoff_event_mutation();
COMMIT;
