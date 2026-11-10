import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const route = await readFile(new URL('../apps/api/src/interoperability-routes.ts', import.meta.url), 'utf8');
const store = await readFile(new URL('../apps/api/src/postgres-interoperability-store.ts', import.meta.url), 'utf8');

test('reconciliation recording is authenticated and schema-validated', () => {
  assert.match(route, /app\.post\('\/v1\/interoperability\/reconciliation-snapshots'/);
  assert.match(route, /ReconciliationSnapshotInputSchema\.safeParse/);
  assert.match(route, /externalTransferPerformed:false/);
});

test('reconciliation recording is tenant-scoped and append-only', () => {
  assert.match(store, /set_config\('app\.organization_id',\$1,true\)/);
  assert.match(store, /WHERE organization_id=\$1 AND id=\$2 FOR SHARE/);
  assert.match(store, /reconciliation_already_recorded/);
  assert.match(store, /interoperability_reconciliation_snapshots/);
  assert.match(store, /interoperability\.reconciliation_recorded/);
});
