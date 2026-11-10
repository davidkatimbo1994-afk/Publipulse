import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root,'apps/api/migrations/015_interoperability_governance.sql'),'utf8');
const shared = fs.readFileSync(path.join(root,'packages/shared/src/interoperability.ts'),'utf8');
const routes = fs.readFileSync(path.join(root,'apps/api/src/interoperability-routes.ts'),'utf8');
const store = fs.readFileSync(path.join(root,'apps/api/src/postgres-interoperability-store.ts'),'utf8');

test('phase 7 migration defines country, programme, indicator, sharing and integration metadata', () => {
  for (const token of ['country_configs','programmes','indicator_definitions','country_indicator_mappings','data_sharing_policies','integration_profiles']) {
    assert.match(migration, new RegExp(`CREATE TABLE ${token}`));
  }
  assert.match(migration, /ALTER TABLE data_sharing_policies ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE integration_profiles ENABLE ROW LEVEL SECURITY/);
});

test('integration profiles cannot become a credential store', () => {
  assert.doesNotMatch(migration, /\b(password|secret|token|client_secret|private_key)\b/i);
  assert.match(shared, /provider: z\.enum\(\['dhis2','csv','fhir','other'\]\)/);
  assert.match(routes, /not proof of a live external-system integration/);
});

test('sharing policies carry explicit classification, destination, indicators and suppression boundary', () => {
  assert.match(shared, /classification: z\.enum\(\['aggregate','operational','sensitive'\]\)/);
  assert.match(shared, /destinationType: z\.enum/);
  assert.match(shared, /allowedIndicatorCodes/);
  assert.match(shared, /minimumCellSize/);
  assert.match(migration, /allow_cross_border boolean NOT NULL DEFAULT false/);
});

test('policy writes are tenant scoped and audited', () => {
  assert.match(store, /set_config\('app\.organization_id'/);
  assert.match(store, /governance\.sharing_policy_created/);
  assert.match(migration, /CREATE POLICY data_sharing_policies_tenant/);
});
