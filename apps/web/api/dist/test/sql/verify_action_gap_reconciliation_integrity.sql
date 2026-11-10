-- Verify structural safeguards relied upon by Action Gap lifecycle reconciliation.
-- Run after all migrations against a disposable PostgreSQL database.
DO $$
DECLARE
  gap_rls boolean;
  gap_policy boolean;
  fingerprint_index boolean;
  audit_append_only boolean;
BEGIN
  SELECT c.relrowsecurity INTO gap_rls
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname=current_schema() AND c.relname='action_gap_detections';
  IF gap_rls IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Action Gap detections must have row-level security enabled';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname=current_schema() AND tablename='action_gap_detections'
      AND policyname='tenant_isolation'
      AND qual LIKE '%app.organization_id%'
      AND with_check LIKE '%app.organization_id%'
  ) INTO gap_policy;
  IF NOT gap_policy THEN
    RAISE EXCEPTION 'Action Gap tenant isolation policy is missing or incomplete';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname=current_schema() AND tablename='action_gap_detections'
      AND indexname='action_gap_org_fingerprint_uidx'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%organization_id%'
      AND indexdef ILIKE '%fingerprint%' AND indexdef ILIKE '%WHERE (fingerprint IS NOT NULL)%'
  ) INTO fingerprint_index;
  IF NOT fingerprint_index THEN
    RAISE EXCEPTION 'Organization-scoped fingerprint idempotency index is missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    WHERE c.relname='audit_events' AND NOT t.tgisinternal
      AND t.tgname='audit_events_no_update'
  ) INTO audit_append_only;
  IF NOT audit_append_only THEN
    RAISE EXCEPTION 'Append-only audit mutation guard is missing';
  END IF;
END $$;

SELECT 'Action Gap reconciliation schema integrity: passed' AS result;
