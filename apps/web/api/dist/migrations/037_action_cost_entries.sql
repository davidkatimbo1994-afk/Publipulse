-- Append-only cost evidence for response actions (planned vs actual), so reviews can weigh cost against outcome.
BEGIN;

CREATE TABLE action_cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  client_mutation_id text,
  signal_id uuid NOT NULL,
  action_id uuid NOT NULL,
  cost_kind text NOT NULL CHECK (cost_kind IN ('planned','actual')),
  cost_category text NOT NULL CHECK (cost_category IN ('personnel','supplies','transport','laboratory','communication','training','infrastructure','other')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0 AND amount <= 100000000000),
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  incurred_on date NOT NULL,
  note text CHECK (note IS NULL OR length(trim(note)) BETWEEN 3 AND 500),
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, signal_id) REFERENCES signals(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, action_id) REFERENCES response_actions(organization_id, id) ON DELETE RESTRICT,
  CHECK (client_mutation_id IS NULL OR client_mutation_id ~ '^[A-Za-z0-9._:-]{16,128}$'),
  UNIQUE (organization_id, id)
);

CREATE UNIQUE INDEX action_cost_entries_org_mutation_uidx
  ON action_cost_entries(organization_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE INDEX action_cost_entries_org_action_idx
  ON action_cost_entries(organization_id, action_id, incurred_on DESC, created_at DESC);

ALTER TABLE action_cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_cost_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY action_cost_entries_tenant_policy ON action_cost_entries
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

REVOKE UPDATE, DELETE ON action_cost_entries FROM PUBLIC;

CREATE OR REPLACE FUNCTION reject_action_cost_entry_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'action cost entries are append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER action_cost_entries_no_update
  BEFORE UPDATE OR DELETE ON action_cost_entries
  FOR EACH ROW EXECUTE FUNCTION reject_action_cost_entry_mutation();

COMMIT;
