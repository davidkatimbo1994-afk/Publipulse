-- Keep operational Action Graph relationships within one signal's workflow.
-- `related_to` is the sole intentionally cross-signal relationship type.
BEGIN;

CREATE FUNCTION enforce_graph_edge_signal_scope() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  from_signal_id uuid;
  to_signal_id uuid;
BEGIN
  CASE NEW.from_type
    WHEN 'signal' THEN
      SELECT id INTO from_signal_id FROM signals
      WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
    WHEN 'evidence' THEN
      SELECT signal_id INTO from_signal_id FROM evidence
      WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
    WHEN 'investigation' THEN
      SELECT signal_id INTO from_signal_id FROM investigations
      WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
    WHEN 'decision' THEN
      SELECT signal_id INTO from_signal_id FROM decisions
      WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
    WHEN 'action' THEN
      SELECT signal_id INTO from_signal_id FROM response_actions
      WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
    WHEN 'outcome' THEN
      SELECT signal_id INTO from_signal_id FROM outcomes
      WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
  END CASE;

  CASE NEW.to_type
    WHEN 'signal' THEN
      SELECT id INTO to_signal_id FROM signals
      WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
    WHEN 'evidence' THEN
      SELECT signal_id INTO to_signal_id FROM evidence
      WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
    WHEN 'investigation' THEN
      SELECT signal_id INTO to_signal_id FROM investigations
      WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
    WHEN 'decision' THEN
      SELECT signal_id INTO to_signal_id FROM decisions
      WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
    WHEN 'action' THEN
      SELECT signal_id INTO to_signal_id FROM response_actions
      WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
    WHEN 'outcome' THEN
      SELECT signal_id INTO to_signal_id FROM outcomes
      WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
  END CASE;

  -- Endpoint existence and organization are enforced by the endpoint-integrity trigger.
  -- This trigger adds the domain-level constraint for workflow edges.
  IF NEW.relation <> 'related_to'
     AND (from_signal_id IS NULL OR to_signal_id IS NULL OR from_signal_id <> to_signal_id) THEN
    RAISE EXCEPTION 'workflow graph edges must connect nodes belonging to the same signal; use related_to for cross-signal links'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER graph_edges_signal_scope_integrity
BEFORE INSERT OR UPDATE OF organization_id, from_type, from_id, relation, to_type, to_id
ON graph_edges
FOR EACH ROW EXECUTE FUNCTION enforce_graph_edge_signal_scope();

COMMIT;
