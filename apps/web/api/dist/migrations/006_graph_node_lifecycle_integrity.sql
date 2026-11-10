-- Preserve polymorphic graph references even when a node is later deleted or moved.
-- Row locks in the edge trigger close the check-then-delete race for concurrent writes.
BEGIN;

CREATE OR REPLACE FUNCTION enforce_graph_edge_endpoints() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  from_exists boolean := false;
  to_exists boolean := false;
BEGIN
  CASE NEW.from_type
    WHEN 'signal' THEN PERFORM 1 FROM signals WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
    WHEN 'evidence' THEN PERFORM 1 FROM evidence WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
    WHEN 'investigation' THEN PERFORM 1 FROM investigations WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
    WHEN 'decision' THEN PERFORM 1 FROM decisions WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
    WHEN 'action' THEN PERFORM 1 FROM response_actions WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
    WHEN 'outcome' THEN PERFORM 1 FROM outcomes WHERE organization_id = NEW.organization_id AND id = NEW.from_id FOR KEY SHARE;
  END CASE;
  from_exists := FOUND;

  CASE NEW.to_type
    WHEN 'signal' THEN PERFORM 1 FROM signals WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
    WHEN 'evidence' THEN PERFORM 1 FROM evidence WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
    WHEN 'investigation' THEN PERFORM 1 FROM investigations WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
    WHEN 'decision' THEN PERFORM 1 FROM decisions WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
    WHEN 'action' THEN PERFORM 1 FROM response_actions WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
    WHEN 'outcome' THEN PERFORM 1 FROM outcomes WHERE organization_id = NEW.organization_id AND id = NEW.to_id FOR KEY SHARE;
  END CASE;
  to_exists := FOUND;

  IF NOT from_exists OR NOT to_exists THEN
    RAISE EXCEPTION 'graph edge endpoints must exist in the same organization'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION prevent_graph_node_orphaning() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  node_type graph_node_type;
  is_referenced boolean;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.id IS NOT DISTINCT FROM NEW.id
     AND OLD.organization_id IS NOT DISTINCT FROM NEW.organization_id THEN
    RETURN NEW;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'signals' THEN node_type := 'signal';
    WHEN 'evidence' THEN node_type := 'evidence';
    WHEN 'investigations' THEN node_type := 'investigation';
    WHEN 'decisions' THEN node_type := 'decision';
    WHEN 'response_actions' THEN node_type := 'action';
    WHEN 'outcomes' THEN node_type := 'outcome';
    ELSE RAISE EXCEPTION 'unsupported graph node table: %', TG_TABLE_NAME;
  END CASE;

  SELECT EXISTS (
    SELECT 1 FROM graph_edges
    WHERE organization_id = OLD.organization_id
      AND ((from_type = node_type AND from_id = OLD.id)
        OR (to_type = node_type AND to_id = OLD.id))
  ) INTO is_referenced;

  IF is_referenced THEN
    RAISE EXCEPTION 'a graph node referenced by graph_edges cannot be deleted or moved'
      USING ERRCODE = '23503';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['signals','evidence','investigations','decisions','response_actions','outcomes'] LOOP
    EXECUTE format(
      'CREATE TRIGGER graph_node_reference_guard BEFORE DELETE OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_graph_node_orphaning()',
      t
    );
  END LOOP;
END;
$$;

COMMIT;
