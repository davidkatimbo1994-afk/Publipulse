-- Database-level release gate for outcome evidence/accountability.
-- Run only against the disposable CI database after applying all migrations.
DO $$
DECLARE
  missing_columns text[];
  required_constraint text;
  required_index text;
BEGIN
  SELECT array_agg(required.column_name)
    INTO missing_columns
  FROM (VALUES
    ('target_value'),
    ('assessment_result'),
    ('evidence_source'),
    ('assessment_method'),
    ('uncertainty_note')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name = 'outcomes'
      AND c.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Outcome table is missing required columns: %', missing_columns;
  END IF;

  FOREACH required_constraint IN ARRAY ARRAY[
    'outcomes_assessment_result_check',
    'outcomes_evidence_source_length_check',
    'outcomes_uncertainty_note_length_check',
    'outcomes_assessment_method_length_check',
    'outcomes_action_same_signal_fk'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'outcomes'
        AND c.conname = required_constraint
    ) THEN
      RAISE EXCEPTION 'Missing required outcome constraint: %', required_constraint;
    END IF;
  END LOOP;

  FOREACH required_index IN ARRAY ARRAY[
    'outcomes_org_action_measured_idx',
    'outcomes_org_indicator_measured_idx'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class i
      JOIN pg_namespace n ON n.oid = i.relnamespace
      WHERE n.nspname = current_schema()
        AND i.relname = required_index
        AND i.relkind IN ('i', 'I')
    ) THEN
      RAISE EXCEPTION 'Missing required outcome index in schema %: %', current_schema(), required_index;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema() AND t.relname = 'outcomes' AND t.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Row-level security is not enabled on outcomes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = current_schema()
      AND p.tablename = 'outcomes'
      AND p.policyname = 'tenant_isolation'
  ) THEN
    RAISE EXCEPTION 'Tenant-isolation policy is missing on outcomes';
  END IF;
END $$;

SELECT 'Outcome schema, integrity constraints, indexes, and tenant RLS verified.' AS result;
