-- Inbound USSD/SMS community intake (ADR-006 to ADR-009). Messages land here as pending submissions and become signals
-- only when a reviewer decides so. The sender's phone number is never stored with a submission; only a keyed hash is kept
-- in community_sender_events, for abuse limits, and an operator purges it after 30 days.
BEGIN;

CREATE TABLE community_intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel IN ('ussd','sms')),
  category text NOT NULL CHECK (category IN ('unusual_illness','water_sanitation','supply_gap','animal_health','other')),
  area_code text NOT NULL CHECK (length(area_code) BETWEEN 1 AND 80),
  narrative text CHECK (narrative IS NULL OR length(trim(narrative)) BETWEEN 1 AND 160),
  urgent boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL CHECK (length(consent_version) BETWEEN 1 AND 40),
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);
CREATE INDEX community_intake_submissions_org_received_idx ON community_intake_submissions(organization_id, received_at DESC);

-- One decision per submission, final. A promoted or merged decision names the signal it led to.
CREATE TABLE community_intake_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('promoted','merged','dismissed')),
  reason text CHECK (reason IS NULL OR length(trim(reason)) BETWEEN 3 AND 500),
  signal_id uuid,
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, submission_id) REFERENCES community_intake_submissions(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id, id) ON DELETE RESTRICT,
  CHECK ((decision IN ('promoted','merged')) = (signal_id IS NOT NULL)),
  CHECK (decision = 'promoted' OR reason IS NOT NULL),
  UNIQUE (organization_id, submission_id)
);

-- Keyed hashes only, never joined to a submission (there is no column that could join them).
CREATE TABLE community_sender_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  sender_hash text NOT NULL CHECK (sender_hash ~ '^[0-9a-f]{64}$'),
  -- 'marker' is written once per hour when the organisation-wide cap is first reached, so that event is audited only once.
  kind text NOT NULL CHECK (kind IN ('accepted','rejected','marker')),
  duplicate_hash text CHECK (duplicate_hash IS NULL OR duplicate_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_sender_events_sender_idx ON community_sender_events(organization_id, sender_hash, occurred_at DESC);
CREATE INDEX community_sender_events_org_time_idx ON community_sender_events(organization_id, occurred_at DESC);

ALTER TABLE community_intake_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_intake_submissions FORCE ROW LEVEL SECURITY;
CREATE POLICY community_intake_submissions_tenant_policy ON community_intake_submissions
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE community_intake_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_intake_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY community_intake_reviews_tenant_policy ON community_intake_reviews
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE community_sender_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_sender_events FORCE ROW LEVEL SECURITY;
CREATE POLICY community_sender_events_tenant_policy ON community_sender_events
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

REVOKE UPDATE, DELETE ON community_intake_submissions FROM PUBLIC;
REVOKE UPDATE, DELETE ON community_intake_reviews FROM PUBLIC;
REVOKE UPDATE ON community_sender_events FROM PUBLIC;

CREATE OR REPLACE FUNCTION reject_community_intake_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'community intake submissions and reviews are append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER community_intake_submissions_append_only
  BEFORE UPDATE OR DELETE ON community_intake_submissions
  FOR EACH ROW EXECUTE FUNCTION reject_community_intake_mutation();
CREATE TRIGGER community_intake_reviews_append_only
  BEFORE UPDATE OR DELETE ON community_intake_reviews
  FOR EACH ROW EXECUTE FUNCTION reject_community_intake_mutation();

-- Sender events may be purged by the operator's retention job (30 days) but never edited.
CREATE OR REPLACE FUNCTION reject_community_sender_event_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'community sender events cannot be edited' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER community_sender_events_no_update
  BEFORE UPDATE ON community_sender_events
  FOR EACH ROW EXECUTE FUNCTION reject_community_sender_event_update();

COMMIT;
