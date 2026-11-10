import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const server = await readFile(new URL('apps/api/src/server.ts', root), 'utf8');
const app = await readFile(new URL('apps/api/src/app.ts', root), 'utf8');
const interopRoutes = await readFile(new URL('apps/api/src/interoperability-routes.ts', root), 'utf8');
const interopStore = await readFile(new URL('apps/api/src/postgres-interoperability-store.ts', root), 'utf8');
const migration = await readFile(new URL('apps/api/migrations/025_production_exchange_integrity.sql', root), 'utf8');
const rls = await readFile(new URL('apps/api/test/sql/rls.integration.sql', root), 'utf8');

test('production server wires the action-handoff persistence dependency', () => {
  assert.match(server, /PostgresActionHandoffStore/);
  assert.match(server, /actionHandoffStore:\s*new PostgresActionHandoffStore\(pool\)/);
});

test('readiness requires action-handoff persistence', () => {
  assert.match(app, /options\.actionHandoffStore/);
});

test('production API adds HSTS', () => {
  assert.match(app, /Strict-Transport-Security/);
  assert.match(app, /max-age=31536000/);
});

test('exchange idempotency keys are bounded before persistence', () => {
  assert.match(interopRoutes, /invalid_idempotency_key/);
  assert.match(interopRoutes, /idempotencyKey\.length < 8/);
});

test('exchange idempotency replays require an identical contract fingerprint', () => {
  assert.match(interopStore, /x\.contract_fingerprint !== fingerprint/);
  assert.match(interopStore, /idempotency_conflict/);
});

test('tenant RLS is forced across the Phase 7 and outcome tables', () => {
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  for (const name of ['interoperability_exchange_jobs','interoperability_exchange_receipts','interoperability_exchange_envelopes','persistent_problem_assessments']) {
    assert.match(migration, new RegExp(`'${name}'`));
    assert.match(rls, new RegExp(`'${name}'`));
  }
});

test('exchange evidence cannot be deleted and receipt rows cannot be rewritten', () => {
  assert.match(migration, /interoperability_exchange_jobs_no_delete/);
  assert.match(migration, /interoperability_exchange_receipts_no_update_delete/);
});
