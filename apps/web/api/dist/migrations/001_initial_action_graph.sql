-- PubliPulse initial relational Action Graph schema.
-- PostgreSQL 15+. Apply only through a reviewed migration runner.
-- No direct patient identifiers are modelled in this initial release.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE signal_status AS ENUM ('submitted','under_review','investigating','verified','dismissed','closed');
CREATE TYPE evidence_status AS ENUM ('unreviewed','supported','contradictory','rejected');
CREATE TYPE investigation_status AS ENUM ('open','awaiting_information','completed','cancelled');
CREATE TYPE action_status AS ENUM ('open','in_progress','blocked','completed','cancelled');
CREATE TYPE graph_node_type AS ENUM ('signal','evidence','investigation','decision','action','outcome');

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  country_code char(2) NOT NULL DEFAULT 'UG',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','administrator','reviewer','investigator','responder','analyst','read_only')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  submitted_by uuid NOT NULL,
  client_submission_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('unusual_illness','environmental_hazard','service_disruption','other')),
  summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 10 AND 1000),
  source_type text NOT NULL CHECK (source_type IN ('community_report','facility_report','field_observation','research','other')),
  observed_at timestamptz NOT NULL,
  administrative_area_code text NOT NULL CHECK (length(administrative_area_code) BETWEEN 1 AND 80),
  location_precision text NOT NULL CHECK (location_precision IN ('community','facility','district')),
  status signal_status NOT NULL DEFAULT 'submitted',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, submitted_by, client_submission_id),
  UNIQUE (organization_id, id)
);
CREATE INDEX signals_org_status_created_idx ON signals(organization_id, status, created_at DESC);
CREATE INDEX signals_org_observed_idx ON signals(organization_id, observed_at DESC);

CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid NOT NULL,
  submitted_by uuid NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('document_reference','field_note','aggregate_measurement','official_report','other')),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 2000),
  source_label text NOT NULL CHECK (length(trim(source_label)) BETWEEN 1 AND 240),
  source_uri text,
  observed_at timestamptz,
  status evidence_status NOT NULL DEFAULT 'unreviewed',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id, id) ON DELETE RESTRICT,
  CHECK (source_uri IS NULL OR (source_uri ~ '^https://[^[:space:]]+$' AND length(source_uri) <= 2048)),
  UNIQUE (organization_id, id)
);
CREATE INDEX evidence_signal_idx ON evidence(organization_id, signal_id, created_at);

CREATE TABLE investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  status investigation_status NOT NULL DEFAULT 'open',
  findings text CHECK (findings IS NULL OR length(findings) <= 10000),
  uncertainty_note text CHECK (uncertainty_note IS NULL OR length(uncertainty_note) <= 3000),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id, id) ON DELETE RESTRICT,
  CHECK ((status IN ('completed','cancelled') AND closed_at IS NOT NULL) OR (status NOT IN ('completed','cancelled') AND closed_at IS NULL)),
  UNIQUE (organization_id, id)
);
CREATE INDEX investigations_org_status_idx ON investigations(organization_id, status, opened_at DESC);

CREATE TABLE decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid NOT NULL,
  investigation_id uuid,
  decided_by uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('continue_review','verify','escalate','dismiss','close')),
  rationale text NOT NULL CHECK (length(trim(rationale)) BETWEEN 5 AND 4000),
  evidence_summary text CHECK (evidence_summary IS NULL OR length(evidence_summary) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, investigation_id) REFERENCES investigations(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);

CREATE TABLE response_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid NOT NULL,
  decision_id uuid,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 4000),
  owner_user_id uuid NOT NULL,
  status action_status NOT NULL DEFAULT 'open',
  due_at timestamptz,
  completed_at timestamptz,
  completion_evidence text CHECK (completion_evidence IS NULL OR length(completion_evidence) <= 4000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, decision_id) REFERENCES decisions(organization_id, id) ON DELETE RESTRICT,
  CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR (status <> 'completed' AND completed_at IS NULL)),
  UNIQUE (organization_id, id)
);
CREATE INDEX response_actions_org_status_due_idx ON response_actions(organization_id, status, due_at);

CREATE TABLE outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  signal_id uuid NOT NULL,
  action_id uuid,
  indicator_code text NOT NULL CHECK (length(trim(indicator_code)) BETWEEN 1 AND 120),
  indicator_label text NOT NULL CHECK (length(trim(indicator_label)) BETWEEN 1 AND 240),
  baseline_value numeric,
  measured_value numeric,
  unit text CHECK (unit IS NULL OR length(unit) <= 80),
  baseline_at timestamptz,
  measured_at timestamptz NOT NULL,
  method_note text NOT NULL CHECK (length(trim(method_note)) BETWEEN 3 AND 3000),
  limitation_note text CHECK (limitation_note IS NULL OR length(limitation_note) <= 3000),
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, action_id) REFERENCES response_actions(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, id)
);

-- Generic graph edges preserve provenance and relationship history without requiring a graph DB.
CREATE TABLE graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  from_type graph_node_type NOT NULL,
  from_id uuid NOT NULL,
  relation text NOT NULL CHECK (relation IN ('supports','contradicts','investigates','decides','triggers','implements','measures','supersedes','related_to')),
  to_type graph_node_type NOT NULL,
  to_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  note text CHECK (note IS NULL OR length(note) <= 1000),
  CHECK (from_id <> to_id),
  UNIQUE (organization_id, from_type, from_id, relation, to_type, to_id)
);
CREATE INDEX graph_edges_from_idx ON graph_edges(organization_id, from_type, from_id);
CREATE INDEX graph_edges_to_idx ON graph_edges(organization_id, to_type, to_id);

-- Audit rows are append-only at the privilege layer. Never store raw health payloads or secrets here.
CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 120),
  resource_type text NOT NULL CHECK (length(resource_type) BETWEEN 1 AND 80),
  resource_id uuid,
  request_id text CHECK (request_id IS NULL OR length(request_id) <= 120),
  outcome text NOT NULL CHECK (outcome IN ('success','denied','failure')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(metadata) <= 8192),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_time_idx ON audit_events(organization_id, occurred_at DESC);

-- Guard against accidental audit mutation even if a role is over-granted. Privilege separation is still required.
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

-- Server must set app.organization_id from a verified membership, never directly from client input.
-- FORCE ROW LEVEL SECURITY prevents table owners from bypassing policies in ordinary application access.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organizations
  USING (id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.organization_id', true), '')::uuid);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['organization_memberships','signals','evidence','investigations','decisions','response_actions','outcomes','graph_edges','audit_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)', t);
  END LOOP;
END $$;

-- This migration intentionally does not grant app roles. Provision a non-owner runtime role separately,
-- grant only required operations, and ensure each request sets tenant scope in a transaction.
COMMIT;
