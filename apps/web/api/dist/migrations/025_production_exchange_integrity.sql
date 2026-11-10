-- Production hardening: exchange state/evidence integrity.
-- Exchange jobs may transition operationally, but their identity and evidence
-- cannot be deleted or rewritten. A conflicting idempotency key is handled
-- before insertion by the API and is also protected by the unique constraint.
BEGIN;


-- Force tenant RLS on every organization-scoped table introduced after the
-- original schema. Table owners must not bypass these policies in production.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'programmes','organization_programmes','data_sharing_policies','integration_profiles',
    'interoperability_exchange_jobs','interoperability_exchange_receipts',
    'interoperability_provenance_events','interoperability_reconciliation_snapshots',
    'dhis2_indicator_mappings','dhis2_org_unit_mappings','dhis2_metadata_reconciliation_runs',
    'outcome_case_reviews','recurrence_patterns','expert_recommendations','outcome_review_tasks',
    'expert_recommendation_reviews','intervention_evaluations','recurrence_cluster_assessments',
    'root_cause_hypotheses','root_cause_hypothesis_reviews','intervention_learning_summaries',
    'persistent_problem_assessments','interoperability_exchange_envelopes'
  ] LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION reject_exchange_evidence_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'interoperability exchange evidence is append-only';
END;
$$;

CREATE TRIGGER interoperability_exchange_jobs_no_delete
BEFORE DELETE ON interoperability_exchange_jobs
FOR EACH ROW EXECUTE FUNCTION reject_exchange_evidence_delete();

CREATE TRIGGER interoperability_exchange_receipts_no_update_delete
BEFORE UPDATE OR DELETE ON interoperability_exchange_receipts
FOR EACH ROW EXECUTE FUNCTION reject_exchange_evidence_delete();

CREATE OR REPLACE FUNCTION enforce_exchange_job_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id <> OLD.organization_id
     OR NEW.idempotency_key <> OLD.idempotency_key
     OR NEW.contract_fingerprint <> OLD.contract_fingerprint
     OR NEW.integration_profile_id <> OLD.integration_profile_id
     OR NEW.provider <> OLD.provider
     OR NEW.direction <> OLD.direction
     OR NEW.mode <> OLD.mode
     OR NEW.country_code <> OLD.country_code
     OR NEW.programme_code IS DISTINCT FROM OLD.programme_code
     OR NEW.indicator_codes <> OLD.indicator_codes
     OR NEW.mapping_version <> OLD.mapping_version
     OR NEW.administrative_unit_mapping_version IS DISTINCT FROM OLD.administrative_unit_mapping_version
     OR NEW.purpose <> OLD.purpose
     OR NEW.cross_border <> OLD.cross_border
     OR NEW.created_by <> OLD.created_by
     OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'exchange job identity/evidence fields are immutable';
  END IF;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'queued' AND NEW.status IN ('running','rejected','cancelled')) OR
    (OLD.status = 'running' AND NEW.status IN ('succeeded','failed','cancelled')) OR
    (OLD.status = 'failed' AND NEW.status IN ('queued','cancelled'))
  ) THEN
    RAISE EXCEPTION 'invalid exchange job status transition from % to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER interoperability_exchange_jobs_transition_guard
BEFORE UPDATE ON interoperability_exchange_jobs
FOR EACH ROW EXECUTE FUNCTION enforce_exchange_job_transition();

ALTER TABLE interoperability_exchange_jobs
  ADD CONSTRAINT interoperability_exchange_jobs_org_id_unique UNIQUE (organization_id, id);

ALTER TABLE interoperability_exchange_receipts
  ADD CONSTRAINT interoperability_exchange_receipts_org_job_fk
  FOREIGN KEY (organization_id, exchange_job_id)
  REFERENCES interoperability_exchange_jobs(organization_id, id)
  ON DELETE RESTRICT;

ALTER TABLE interoperability_exchange_receipts
  ADD CONSTRAINT interoperability_exchange_receipts_provider_consistency
  CHECK (provider IN ('dhis2','fhir','csv','other'));

COMMENT ON TABLE interoperability_exchange_jobs IS
  'Tenant-scoped exchange state. Identity/evidence fields are immutable; status changes follow an explicit state machine. No delete is permitted.';
COMMENT ON TABLE interoperability_exchange_receipts IS
  'Tenant-scoped exchange receipts. Receipts are append-only and cannot be updated or deleted.';

COMMIT;
