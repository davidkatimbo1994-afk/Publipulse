-- Append-only commodity stock snapshots; consumption velocity and days-of-stock-left are derived at read time.
BEGIN;

CREATE TABLE commodity_stock_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  client_mutation_id text,
  administrative_area_code text NOT NULL CHECK (length(trim(administrative_area_code)) BETWEEN 1 AND 80 AND administrative_area_code ~ '^[A-Za-z0-9._-]+$'),
  commodity_code text NOT NULL CHECK (length(trim(commodity_code)) BETWEEN 1 AND 80 AND commodity_code ~ '^[A-Za-z0-9._-]+$'),
  unit text NOT NULL CHECK (length(trim(unit)) BETWEEN 1 AND 40),
  quantity_on_hand numeric(14,2) NOT NULL CHECK (quantity_on_hand >= 0 AND quantity_on_hand <= 100000000000),
  quantity_received numeric(14,2) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0 AND quantity_received <= 100000000000),
  observed_at timestamptz NOT NULL,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (client_mutation_id IS NULL OR client_mutation_id ~ '^[A-Za-z0-9._:-]{16,128}$'),
  UNIQUE (organization_id, id)
);

CREATE UNIQUE INDEX commodity_stock_snapshots_org_mutation_uidx
  ON commodity_stock_snapshots(organization_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE INDEX commodity_stock_snapshots_series_idx
  ON commodity_stock_snapshots(organization_id, administrative_area_code, commodity_code, unit, observed_at DESC, created_at DESC);

ALTER TABLE commodity_stock_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE commodity_stock_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY commodity_stock_snapshots_tenant_policy ON commodity_stock_snapshots
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

REVOKE UPDATE, DELETE ON commodity_stock_snapshots FROM PUBLIC;

CREATE OR REPLACE FUNCTION reject_commodity_stock_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'commodity stock snapshots are append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER commodity_stock_snapshots_no_update
  BEFORE UPDATE OR DELETE ON commodity_stock_snapshots
  FOR EACH ROW EXECUTE FUNCTION reject_commodity_stock_snapshot_mutation();

COMMIT;
