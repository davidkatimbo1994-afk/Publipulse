-- Polymorphic graph edges cannot use ordinary foreign keys. Validate both endpoints
-- against their concrete tables and the edge's tenant at write time.
BEGIN;

CREATE FUNCTION enforce_graph_edge_endpoints() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  from_exists boolean := false;
  to_exists boolean := false;
BEGIN
  CASE NEW.from_type
    WHEN 'signal' THEN SELECT EXISTS (SELECT 1 FROM signals WHERE organization_id = NEW.organization_id AND id = NEW.from_id) INTO from_exists;
    WHEN 'evidence' THEN SELECT EXISTS (SELECT 1 FROM evidence WHERE organization_id = NEW.organization_id AND id = NEW.from_id) INTO from_exists;
    WHEN 'investigation' THEN SELECT EXISTS (SELECT 1 FROM investigations WHERE organization_id = NEW.organization_id AND id = NEW.from_id) INTO from_exists;
    WHEN 'decision' THEN SELECT EXISTS (SELECT 1 FROM decisions WHERE organization_id = NEW.organization_id AND id = NEW.from_id) INTO from_exists;
    WHEN 'action' THEN SELECT EXISTS (SELECT 1 FROM response_actions WHERE organization_id = NEW.organization_id AND id = NEW.from_id) INTO from_exists;
    WHEN 'outcome' THEN SELECT EXISTS (SELECT 1 FROM outcomes WHERE organization_id = NEW.organization_id AND id = NEW.from_id) INTO from_exists;
  END CASE;

  CASE NEW.to_type
    WHEN 'signal' THEN SELECT EXISTS (SELECT 1 FROM signals WHERE organization_id = NEW.organization_id AND id = NEW.to_id) INTO to_exists;
    WHEN 'evidence' THEN SELECT EXISTS (SELECT 1 FROM evidence WHERE organization_id = NEW.organization_id AND id = NEW.to_id) INTO to_exists;
    WHEN 'investigation' THEN SELECT EXISTS (SELECT 1 FROM investigations WHERE organization_id = NEW.organization_id AND id = NEW.to_id) INTO to_exists;
    WHEN 'decision' THEN SELECT EXISTS (SELECT 1 FROM decisions WHERE organization_id = NEW.organization_id AND id = NEW.to_id) INTO to_exists;
    WHEN 'action' THEN SELECT EXISTS (SELECT 1 FROM response_actions WHERE organization_id = NEW.organization_id AND id = NEW.to_id) INTO to_exists;
    WHEN 'outcome' THEN SELECT EXISTS (SELECT 1 FROM outcomes WHERE organization_id = NEW.organization_id AND id = NEW.to_id) INTO to_exists;
  END CASE;

  IF NOT from_exists OR NOT to_exists THEN
    RAISE EXCEPTION 'graph edge endpoints must exist in the same organization'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER graph_edges_endpoint_integrity
BEFORE INSERT OR UPDATE OF organization_id, from_type, from_id, to_type, to_id
ON graph_edges
FOR EACH ROW EXECUTE FUNCTION enforce_graph_edge_endpoints();

COMMIT;
