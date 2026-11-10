import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => readFile(join(root, p), 'utf8');
const migration = await read('apps/api/migrations/037_action_cost_entries.sql');
const routes = await read('apps/api/src/action-cost-routes.ts');
const store = await read('apps/api/src/postgres-action-cost-store.ts');
const schema = await read('packages/shared/src/action-cost.ts');
const app = await read('apps/api/src/app.ts');
const server = await read('apps/api/src/server.ts');

test('action cost evidence is tenant-isolated and append-only', () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE UPDATE, DELETE ON action_cost_entries/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON action_cost_entries/);
  assert.match(migration, /FOREIGN KEY \(organization_id, action_id\) REFERENCES response_actions/);
});

test('action cost routes are authenticated, role-gated, replay-safe and fail closed when unconfigured', () => {
  assert.match(routes, /authentication_required/);
  assert.match(routes, /canRecordActionCost\(actor\)/);
  assert.match(routes, /canReadActionCosts\(actor\)/);
  assert.match(routes, /client_mutation_id_conflict/);
  assert.match(app, /action_cost_service_not_configured/);
  assert.match(server, /new PostgresActionCostStore\(pool\)/);
});

test('action cost store sets tenant context, audits writes and never updates rows', () => {
  assert.match(store, /set_config\('app\.organization_id'/);
  assert.match(store, /action_cost\.recorded/);
  assert.doesNotMatch(store, /\bUPDATE\s+action_cost_entries\b/i);
  assert.doesNotMatch(store, /\bDELETE\s+FROM\s+action_cost_entries\b/i);
});

test('cost note passes the public-health data boundary and amounts are bounded', () => {
  assert.match(schema, /publicHealthNarrative/);
  assert.match(schema, /\.strict\(\)/);
  assert.match(schema, /\[A-Z\]\{3\}/);
});

test('cost summary is read-only, tenant-scoped and honest about what it measures', () => {
  assert.match(routes, /\/v1\/costs\/summary/);
  assert.match(routes, /notCostPerLifeSaved:true/);
  assert.match(store, /BEGIN READ ONLY/);
  assert.match(store, /FROM outcomes WHERE organization_id=\$1/);
  assert.match(app, /url: '\/v1\/costs\/summary'/);
  assert.match(schema, /costPerImprovedAssessment/);
});

const stockMigration = await read('apps/api/migrations/038_commodity_stock_snapshots.sql');
const stockRoutes = await read('apps/api/src/stock-routes.ts');
const stockStore = await read('apps/api/src/postgres-stock-store.ts');
const stockSchema = await read('packages/shared/src/stock-forecast.ts');

test('commodity stock snapshots are tenant-isolated, append-only and never auto-create signals', () => {
  assert.match(stockMigration, /FORCE ROW LEVEL SECURITY/);
  assert.match(stockMigration, /BEFORE UPDATE OR DELETE ON commodity_stock_snapshots/);
  assert.match(stockRoutes, /canRecordStock\(actor\)/);
  assert.match(stockRoutes, /canReadStock\(actor\)/);
  assert.match(stockRoutes, /signalsCreatedAutomatically:false/);
  assert.match(stockRoutes, /observed_at_in_future/);
  assert.match(stockStore, /set_config\('app\.organization_id'/);
  assert.match(stockStore, /BEGIN READ ONLY/);
  assert.doesNotMatch(stockStore, /INSERT INTO signals/i);
  assert.doesNotMatch(stockStore, /\bUPDATE\s+commodity_stock_snapshots\b/i);
  assert.match(app, /stock_service_not_configured/);
  assert.match(server, /new PostgresStockStore\(pool\)/);
});

test('stock inputs are bounded aggregates', () => {
  assert.match(stockSchema, /\.strict\(\)/);
  assert.match(stockSchema, /STOCK_STALE_AFTER_DAYS/);
  assert.match(stockSchema, /Nothing is created automatically/);
});

const ctxMigration = await read('apps/api/migrations/039_external_context_observations.sql');
const ctxRoutes = await read('apps/api/src/context-routes.ts');
const ctxStore = await read('apps/api/src/postgres-context-store.ts');
const ctxSchema = await read('packages/shared/src/external-context.ts');

test('external context is tenant-isolated, append-only, role-gated and makes no causal claim', () => {
  assert.match(ctxMigration, /FORCE ROW LEVEL SECURITY/);
  assert.match(ctxMigration, /BEFORE UPDATE OR DELETE ON external_context_observations/);
  assert.match(ctxMigration, /source_label text NOT NULL/);
  assert.match(ctxRoutes, /canRecordContext\(actor\)/);
  assert.match(ctxRoutes, /canReadContext\(actor\)/);
  assert.match(ctxRoutes, /causalClaim:false/);
  assert.match(ctxStore, /set_config\('app\.organization_id'/);
  assert.match(ctxStore, /BEGIN READ ONLY/);
  assert.doesNotMatch(ctxStore, /\bUPDATE\s+external_context_observations\b/i);
  assert.doesNotMatch(ctxStore, /\bfetch\(|https?:\/\/[a-z]/i);
  assert.match(app, /context_service_not_configured/);
  assert.match(server, /new PostgresContextStore\(pool\)/);
});

test('external context inputs require provenance and bounded periods', () => {
  assert.match(ctxSchema, /\.strict\(\)/);
  assert.match(ctxSchema, /sourceLabel: z\.string\(\)\.trim\(\)\.min\(1\)/);
  assert.match(ctxSchema, /at most 31 days/);
  assert.match(ctxSchema, /CONTEXT_MIN_BASELINE/);
});
