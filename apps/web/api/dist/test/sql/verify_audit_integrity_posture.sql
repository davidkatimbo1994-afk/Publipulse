-- Operational posture check for the append-only, tenant-scoped audit table.
-- This verifies configured database controls; it does NOT prove cryptographic
-- authenticity, completeness, or protection from a privileged database owner.
DO $$
DECLARE
  audit_table oid;
  enabled_rls boolean;
  forced_rls boolean;
  policy_count integer;
BEGIN
  SELECT c.oid, c.relrowsecurity, c.relforcerowsecurity
    INTO audit_table, enabled_rls, forced_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'audit_events' AND c.relkind = 'r';

  IF audit_table IS NULL THEN
    RAISE EXCEPTION 'Audit integrity check failed: public.audit_events is missing';
  END IF;
  IF NOT enabled_rls OR NOT forced_rls THEN
    RAISE EXCEPTION 'Audit integrity check failed: row-level security must be enabled and forced';
  END IF;

  SELECT count(*) INTO policy_count
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'audit_events'
    AND p.policyname = 'tenant_isolation' AND p.permissive = 'PERMISSIVE'
    AND p.cmd = 'ALL' AND p.qual ILIKE '%organization_id%'
    AND p.qual ILIKE '%app.organization_id%'
    AND p.with_check ILIKE '%organization_id%'
    AND p.with_check ILIKE '%app.organization_id%';
  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Audit integrity check failed: expected exactly one tenant-isolation policy';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = audit_table AND t.tgname = 'audit_events_no_update'
      AND NOT t.tgisinternal AND t.tgenabled = 'O'
      AND t.tgfoid = 'public.reject_audit_mutation()'::regprocedure
      AND (t.tgtype & 1) = 1 AND (t.tgtype & 2) = 2 AND (t.tgtype & 16) = 16 AND (t.tgtype & 8) = 8
  ) THEN
    RAISE EXCEPTION 'Audit integrity check failed: enabled UPDATE/DELETE append-only trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = audit_table AND t.tgname = 'audit_events_no_truncate'
      AND NOT t.tgisinternal AND t.tgenabled = 'O'
      AND t.tgfoid = 'public.reject_audit_mutation()'::regprocedure
      AND (t.tgtype & 32) = 32
  ) THEN
    RAISE EXCEPTION 'Audit integrity check failed: enabled TRUNCATE guard is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    WHERE con.conrelid = audit_table AND con.conname = 'audit_events_metadata_object_check'
      AND con.contype = 'c' AND con.convalidated
  ) THEN
    RAISE EXCEPTION 'Audit integrity check failed: validated metadata-object constraint is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM aclexplode(coalesce((SELECT c.relacl FROM pg_class c WHERE c.oid = audit_table),
                             acldefault('r', (SELECT c.relowner FROM pg_class c WHERE c.oid = audit_table)))) acl
    WHERE acl.grantee = 0
      AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ) THEN
    RAISE EXCEPTION 'Audit integrity check failed: PUBLIC has table privileges on audit_events';
  END IF;
END $$;

SELECT 'audit integrity posture checks passed (not a cryptographic authenticity guarantee)' AS result;
