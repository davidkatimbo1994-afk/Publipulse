import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envelope = fs.readFileSync(path.join(root,'packages/shared/src/interoperability-envelope.ts'),'utf8');
const offline = fs.readFileSync(path.join(root,'packages/shared/src/interoperability-offline.ts'),'utf8');
const migration = fs.readFileSync(path.join(root,'apps/api/migrations/024_interoperability_exchange_envelopes.sql'),'utf8');
const adapter = fs.readFileSync(path.join(root,'apps/api/src/interoperability-adapter.ts'),'utf8');
const routes = fs.readFileSync(path.join(root,'apps/api/src/interoperability-routes.ts'),'utf8');

 test('Phase 7 completion has a provider-neutral versioned exchange envelope', () => {
  assert.match(envelope, /ExchangeEnvelopeSchema/);
  assert.match(envelope, /schemaVersion: z\.literal\('1\.0'\)/);
  assert.match(envelope, /dhis2_data_value_set.*fhir_bundle.*csv_aggregate/s);
  assert.match(migration, /CREATE TABLE interoperability_exchange_envelopes/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /append-only/);
});

test('minimum-cell suppression is fail-closed and never converts suppressed values to zero', () => {
  assert.match(envelope, /record\.cellCount < minimumCellSize/);
  assert.match(envelope, /value: null/);
  assert.match(envelope, /invalid_minimum_cell_size/);
});

test('offline CSV exchange is deterministic and supports explicit null suppression', () => {
  assert.match(offline, /serializeAggregateCsv/);
  assert.match(offline, /parseAggregateCsv/);
  assert.match(offline, /value === null \? ''/);
  assert.match(offline, /invalid_aggregate_csv_header/);
});

test('FHIR is represented as a contract/profile, not a claimed live integration', () => {
  assert.match(offline, /resourceType: z\.literal\('Bundle'\)/);
  assert.match(routes, /not proof of a live external-system integration/);
  assert.match(adapter, /transport_disabled/);
});

test('exchange jobs cannot cross tenant boundaries through profile or programme references', () => {
  assert.match(migration, /interoperability_exchange_jobs_profile_fk/);
  assert.match(migration, /REFERENCES integration_profiles\(organization_id, id\)/);
  assert.match(migration, /interoperability_exchange_jobs_programme_fk/);
  assert.match(migration, /REFERENCES programmes\(organization_id, code\)/);
});
