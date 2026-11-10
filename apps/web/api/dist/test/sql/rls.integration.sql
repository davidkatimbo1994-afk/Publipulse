\set ON_ERROR_STOP on

-- Runs as the PostgreSQL bootstrap superuser against a disposable database.
-- Seed records as the privileged migration/test role, then exercise the runtime role.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'publipulse_runtime_test') THEN
    CREATE ROLE publipulse_runtime_test LOGIN PASSWORD 'runtime-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'publipulse_audit_mutator_test') THEN
    CREATE ROLE publipulse_audit_mutator_test LOGIN PASSWORD 'audit-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'publipulse_audit_reader_test') THEN
    CREATE ROLE publipulse_audit_reader_test LOGIN PASSWORD 'audit-reader-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO publipulse_runtime_test, publipulse_audit_mutator_test, publipulse_audit_reader_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations, organization_memberships, signals, evidence,
  investigations, decisions, response_actions, outcomes, graph_edges TO publipulse_runtime_test;
GRANT SELECT, INSERT ON audit_events TO publipulse_runtime_test;
GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO publipulse_runtime_test;
-- The audit-reader role can read only the allowlisted summary columns, never raw metadata.
GRANT SELECT (id, actor_user_id, action, resource_type, resource_id, outcome, occurred_at) ON audit_events TO publipulse_audit_reader_test;
-- This deliberately over-privileged test role proves the trigger still blocks audit tampering.
GRANT SELECT, UPDATE, DELETE, TRUNCATE ON audit_events TO publipulse_audit_mutator_test;

-- Catch accidental schema-security regressions before data-level assertions run.
DO $$
DECLARE
  table_name text;
  relation_oid oid;
  rel record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations', 'organization_memberships', 'signals', 'evidence',
    'investigations', 'decisions', 'response_actions', 'outcomes',
    'graph_edges', 'audit_events', 'programmes', 'organization_programmes',
    'data_sharing_policies', 'integration_profiles', 'interoperability_exchange_jobs',
    'interoperability_exchange_receipts', 'interoperability_provenance_events',
    'interoperability_reconciliation_snapshots', 'dhis2_indicator_mappings',
    'dhis2_org_unit_mappings', 'dhis2_metadata_reconciliation_runs',
    'outcome_case_reviews', 'recurrence_patterns', 'expert_recommendations',
    'outcome_review_tasks', 'expert_recommendation_reviews', 'intervention_evaluations',
    'recurrence_cluster_assessments', 'root_cause_hypotheses', 'root_cause_hypothesis_reviews',
    'intervention_learning_summaries', 'persistent_problem_assessments',
    'interoperability_exchange_envelopes'
  ] LOOP
    relation_oid := to_regclass(format('public.%I', table_name));
    IF relation_oid IS NULL THEN
      RAISE EXCEPTION 'Required tenant table public.% is missing', table_name;
    END IF;
    SELECT c.relrowsecurity, c.relforcerowsecurity INTO rel
      FROM pg_class c WHERE c.oid = relation_oid;
    IF NOT rel.relrowsecurity OR NOT rel.relforcerowsecurity THEN
      RAISE EXCEPTION 'RLS must be enabled and forced for public.%', table_name;
    END IF;

    -- RLS flags alone are insufficient: a table with no tenant policy is still unsafe.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = table_name
        AND p.cmd = 'ALL' AND p.permissive = 'PERMISSIVE'
        AND position('app.organization_id' IN coalesce(p.qual, '')) > 0
        AND position('app.organization_id' IN coalesce(p.with_check, '')) > 0
    ) THEN
      RAISE EXCEPTION 'Missing or incomplete permissive tenant policy on public.%', table_name;
    END IF;

    -- PostgreSQL combines permissive policies with OR and restrictive policies with AND.
    -- Either kind of unreviewed policy can change the security or availability contract.
    IF EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = table_name
        AND p.policyname NOT IN ('tenant_isolation','programmes_tenant','organization_programmes_tenant','data_sharing_policies_tenant','integration_profiles_tenant','interoperability_exchange_jobs_tenant','interoperability_exchange_receipts_tenant','interoperability_provenance_tenant','interoperability_reconciliation_tenant','dhis2_indicator_mappings_tenant','dhis2_org_unit_mappings_tenant','dhis2_metadata_reconciliation_tenant','interoperability_exchange_envelopes_tenant')
    ) THEN
      RAISE EXCEPTION 'Unexpected additional RLS policy on public.%', table_name;
    END IF;

    -- The runtime contract requires explicit grants, not accidental table privileges
    -- inherited by PUBLIC. Include default ACLs when relacl is NULL.
    IF EXISTS (
      SELECT 1 FROM pg_class c
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
      WHERE c.oid = relation_oid AND acl.grantee = 0::oid
    ) THEN
      RAISE EXCEPTION 'PUBLIC has table privileges on protected table public.%', table_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_events'
      AND t.tgname = 'audit_events_no_update' AND NOT t.tgisinternal AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'Enabled append-only audit mutation trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_events'
      AND con.conname = 'audit_events_metadata_object_check' AND con.contype = 'c' AND con.convalidated
      AND position('jsonb_typeof(metadata)' IN pg_get_constraintdef(con.oid)) > 0
  ) THEN
    RAISE EXCEPTION 'Validated audit metadata object constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_events'
      AND t.tgname = 'audit_events_no_truncate' AND t.tgtype & 32 = 32
      AND NOT t.tgisinternal AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'Enabled audit TRUNCATE guard trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'publipulse_runtime_test' AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcreatedb AND NOT rolcreaterole
  ) THEN
    RAISE EXCEPTION 'Runtime integration role has excessive cluster privileges';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'publipulse_audit_mutator_test' AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcreatedb AND NOT rolcreaterole
  ) THEN
    RAISE EXCEPTION 'Audit-mutator integration role has excessive cluster privileges';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'publipulse_audit_reader_test' AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcreatedb AND NOT rolcreaterole
  ) THEN
    RAISE EXCEPTION 'Audit-reader integration role has excessive cluster privileges';
  END IF;
  IF has_column_privilege('publipulse_audit_reader_test', 'public.audit_events', 'metadata', 'SELECT') THEN
    RAISE EXCEPTION 'Audit-reader role must not read arbitrary audit metadata';
  END IF;
  IF NOT has_column_privilege('publipulse_audit_reader_test', 'public.audit_events', 'action', 'SELECT') THEN
    RAISE EXCEPTION 'Audit-reader role lacks required summary-column access';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles member_role ON member_role.oid = m.member
    WHERE member_role.rolname IN ('publipulse_runtime_test', 'publipulse_audit_mutator_test', 'publipulse_audit_reader_test')
  ) THEN
    RAISE EXCEPTION 'Integration roles must not inherit or be able to SET ROLE to any other role';
  END IF;
END $$;

INSERT INTO organizations (id, name, country_code) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Test Organisation One', 'UG'),
  ('10000000-0000-4000-8000-000000000002', 'Test Organisation Two', 'UG')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_memberships (organization_id, user_id, role) VALUES
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'owner'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'auditor')
ON CONFLICT (organization_id, user_id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = '10000000-0000-4000-8000-000000000001' AND user_id = '20000000-0000-4000-8000-000000000003' AND role = 'auditor' AND active) THEN
    RAISE EXCEPTION 'Persisted auditor membership role is not accepted';
  END IF;
END $$;

INSERT INTO signals (id, organization_id, submitted_by, client_submission_id, category, summary, source_type, observed_at, administrative_area_code, location_precision)
VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'other', 'Synthetic test signal for tenant one', 'other', now(), 'UG-TEST-1', 'district'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'other', 'Synthetic test signal for tenant two', 'other', now(), 'UG-TEST-2', 'district')
ON CONFLICT (id) DO NOTHING;

INSERT INTO investigations (id, organization_id, signal_id, owner_user_id)
VALUES
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO decisions (id, organization_id, signal_id, investigation_id, decided_by, decision, rationale)
VALUES
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'continue_review', 'Synthetic integration-test rationale one'),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'continue_review', 'Synthetic integration-test rationale two')
ON CONFLICT (id) DO NOTHING;

INSERT INTO outcomes (id, organization_id, signal_id, indicator_code, indicator_label, measured_at, method_note, recorded_by)
VALUES ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'TEST-INDICATOR', 'Synthetic test outcome', now(), 'Synthetic integration test only', '20000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM audit_events WHERE organization_id = '10000000-0000-4000-8000-000000000001' AND action = 'test.seed' AND resource_type = 'integration_test') THEN
    INSERT INTO audit_events (organization_id, actor_user_id, action, resource_type, outcome)
    VALUES ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'test.seed', 'integration_test', 'success');
  END IF;
END $$;

-- JSONB accepts arrays and scalars; audit metadata must be an object for consistent consumers.
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    INSERT INTO audit_events (organization_id, actor_user_id, action, resource_type, outcome, metadata)
    VALUES ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
      'metadata_shape_rejected', 'integration_test', 'success', '["not", "an", "object"]'::jsonb);
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Audit metadata shape constraint accepted a JSON array'; END IF;
END $$;

BEGIN;
SET LOCAL ROLE publipulse_runtime_test;
-- Fail closed when tenant scope is absent: no tenant rows should be visible.
DO $$ DECLARE visible_count integer; BEGIN
  SELECT count(*) INTO visible_count FROM signals;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'RLS exposed signals without tenant scope: %', visible_count; END IF;
END $$;
SELECT set_config('app.organization_id', '10000000-0000-4000-8000-000000000001', true);

DO $$ DECLARE visible_count integer; BEGIN
  SELECT count(*) INTO visible_count FROM signals;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'RLS tenant isolation failed: expected 1 visible signal, got %', visible_count; END IF;
  SELECT count(*) INTO visible_count FROM organizations;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'RLS organization isolation failed: expected 1 visible organization, got %', visible_count; END IF;
  SELECT count(*) INTO visible_count FROM audit_events;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'RLS audit isolation failed: expected 1 visible event, got %', visible_count; END IF;
END $$;

-- Exercise a least-privilege audit reader: tenant RLS applies and raw metadata is inaccessible.
SET LOCAL ROLE publipulse_audit_reader_test;
SELECT set_config('app.organization_id', '10000000-0000-4000-8000-000000000001', true);
DO $$ DECLARE visible_count integer; BEGIN
  SELECT count(action) INTO visible_count FROM audit_events;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Audit-reader RLS expected one tenant-one event, got %', visible_count; END IF;
  BEGIN
    PERFORM metadata FROM audit_events;
    RAISE EXCEPTION 'Audit-reader unexpectedly selected raw metadata';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SET LOCAL ROLE publipulse_runtime_test;

-- Verify that rows belonging to tenant two are invisible across every table with
-- organization_id, not just the signals table. Seeded rows make this a data-level
-- cross-tenant regression check rather than a policy-definition-only assertion.
DO $$
DECLARE
  table_name text;
  visible_count integer;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organization_memberships', 'signals', 'evidence', 'investigations',
    'decisions', 'response_actions', 'outcomes', 'graph_edges', 'audit_events'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE organization_id = $1', table_name)
      INTO visible_count
      USING '10000000-0000-4000-8000-000000000002'::uuid;
    IF visible_count <> 0 THEN
      RAISE EXCEPTION 'RLS exposed tenant-two rows in public.%: % rows visible', table_name, visible_count;
    END IF;
  END LOOP;
END $$;

-- The tenant check must reject writes explicitly claiming another organisation.
DO $$ BEGIN
  BEGIN
    INSERT INTO signals (organization_id, submitted_by, client_submission_id, category, summary, source_type, observed_at, administrative_area_code, location_precision)
    VALUES ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'other', 'Must not cross tenant boundary', 'other', now(), 'UG-TEST-1', 'district');
    RAISE EXCEPTION 'RLS allowed cross-tenant insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- The composite foreign keys must reject a decision from tenant two paired with tenant one's signal.
DO $$ BEGIN
  BEGIN
    INSERT INTO response_actions (organization_id, signal_id, decision_id, title, owner_user_id, created_by)
    VALUES ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 'Cross-signal action must fail', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Cross-signal action relationship was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- A valid same-tenant edge is accepted, but cross-tenant and missing endpoints are rejected.
INSERT INTO graph_edges (organization_id, from_type, from_id, relation, to_type, to_id, created_by)
VALUES ('10000000-0000-4000-8000-000000000001', 'signal', '30000000-0000-4000-8000-000000000001', 'measures', 'outcome', '70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
ON CONFLICT (organization_id, from_type, from_id, relation, to_type, to_id) DO NOTHING;

DO $$ BEGIN
  BEGIN
    INSERT INTO graph_edges (organization_id, from_type, from_id, relation, to_type, to_id, created_by)
    VALUES ('10000000-0000-4000-8000-000000000001', 'signal', '30000000-0000-4000-8000-000000000001', 'related_to', 'signal', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Cross-tenant graph endpoint was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO graph_edges (organization_id, from_type, from_id, relation, to_type, to_id, created_by)
    VALUES ('10000000-0000-4000-8000-000000000001', 'signal', '30000000-0000-4000-8000-000000000001', 'related_to', 'outcome', '70000000-0000-4000-8000-000000000099', '20000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Missing graph endpoint was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- Nodes with polymorphic graph references cannot be deleted or moved to another tenant.
DO $$ BEGIN
  BEGIN
    DELETE FROM outcomes WHERE id = '70000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'A graph-referenced outcome was deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- A referenced node cannot be moved across tenants, even if its row still exists.
DO $$ BEGIN
  BEGIN
    UPDATE outcomes SET organization_id = '10000000-0000-4000-8000-000000000002' WHERE id = '70000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'A graph-referenced outcome was moved to another tenant';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- Updating an edge to a missing endpoint must be rejected as well.
DO $$ BEGIN
  BEGIN
    UPDATE graph_edges SET to_id = '70000000-0000-4000-8000-000000000099'
    WHERE organization_id = '10000000-0000-4000-8000-000000000001' AND from_type = 'signal'
      AND from_id = '30000000-0000-4000-8000-000000000001' AND relation = 'measures' AND to_type = 'outcome';
    RAISE EXCEPTION 'Graph edge update accepted a missing endpoint';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- Runtime role has no UPDATE/DELETE privileges on the audit log; trigger is defense in depth.
DO $$ BEGIN
  BEGIN
    UPDATE audit_events SET action = 'tampered' WHERE action = 'test.seed';
    RAISE EXCEPTION 'Runtime role unexpectedly updated audit log';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM audit_events WHERE action = 'test.seed';
    RAISE EXCEPTION 'Runtime role unexpectedly deleted audit log';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

ROLLBACK;
RESET ROLE;

-- The seed row remains append-only and is reused on subsequent test runs.


-- Even if a future grant accidentally permits audit mutation, the trigger must reject it.
BEGIN;
SET LOCAL ROLE publipulse_audit_mutator_test;
SELECT set_config('app.organization_id', '10000000-0000-4000-8000-000000000001', true);
DO $$ BEGIN
  BEGIN
    UPDATE audit_events SET action = 'tampered_by_trigger_test' WHERE action = 'test.seed';
    RAISE EXCEPTION 'Append-only trigger allowed audit UPDATE';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM audit_events WHERE action = 'test.seed';
    RAISE EXCEPTION 'Append-only trigger allowed audit DELETE';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
RESET ROLE;


-- The deliberately over-granted test role must still be stopped by the TRUNCATE trigger.
-- The attempted statement runs inside a PL/pgSQL subtransaction, so the expected error does not
-- abort the rest of the harness; the seeded audit row must remain present afterward.
BEGIN;
SET LOCAL ROLE publipulse_audit_mutator_test;
SELECT set_config('app.organization_id', '10000000-0000-4000-8000-000000000001', true);
DO $$
DECLARE
  truncate_rejected boolean := false;
  remaining_rows integer;
BEGIN
  BEGIN
    EXECUTE 'TRUNCATE TABLE audit_events';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'audit_events are append-only' THEN RAISE; END IF;
    truncate_rejected := true;
  END;
  IF NOT truncate_rejected THEN
    RAISE EXCEPTION 'Append-only trigger allowed audit TRUNCATE';
  END IF;
  SELECT count(*) INTO remaining_rows FROM audit_events WHERE action = 'test.seed';
  IF remaining_rows <> 1 THEN
    RAISE EXCEPTION 'Audit row missing after rejected TRUNCATE; found %', remaining_rows;
  END IF;
END $$;
ROLLBACK;
RESET ROLE;
