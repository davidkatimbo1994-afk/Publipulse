import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require('typescript');
} catch {
  // Allows dependency-free local regression runs in this workspace; CI uses the declared root devDependency.
  ts = (() => { throw new Error('The typescript package is not installed. Run `npm ci` at the repository root, then re-run the tests.'); })();
}

const source = await readFile(new URL('../apps/api/src/postgres-decision-action-store.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { PostgresDecisionActionStore } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const actor = { organizationId: '00000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002', roles: ['owner'] };

function harness({ failAt, rollbackFails = false, releaseFails = false }) {
  const calls = [];
  const originalError = new Error(`primary failure at ${failAt}`);
  let released = false;
  const connection = {
    async query(sql) {
      calls.push(sql);
      if (sql === failAt) throw originalError;
      if (sql === 'ROLLBACK' && rollbackFails) throw new Error('rollback failed');
      return { rows: [] };
    },
    release() {
      released = true;
      if (releaseFails) throw new Error('release failed');
    },
  };
  const store = new PostgresDecisionActionStore({ async connect() { return connection; } });
  return { store, calls, originalError, wasReleased: () => released };
}

test('transaction setup releases the connection and preserves BEGIN failure', async () => {
  const h = harness({ failAt: 'BEGIN' });
  await assert.rejects(h.store.begin(actor), (error) => error === h.originalError);
  assert.ok(h.calls.includes('ROLLBACK'));
  assert.equal(h.wasReleased(), true);
});

test('tenant-scope setup failure rolls back and releases the connection', async () => {
  const h = harness({ failAt: "SELECT set_config('app.organization_id', $1, true)" });
  await assert.rejects(h.store.begin(actor), (error) => error === h.originalError);
  assert.deepEqual(h.calls, ['BEGIN', "SELECT set_config('app.organization_id', $1, true)", 'ROLLBACK']);
  assert.equal(h.wasReleased(), true);
});

test('rollback and release failures do not mask the original setup failure', async () => {
  const h = harness({ failAt: 'BEGIN', rollbackFails: true, releaseFails: true });
  await assert.rejects(h.store.begin(actor), (error) => error === h.originalError);
  assert.equal(h.wasReleased(), true);
});


test('operation failure is not masked by a connection release failure', async () => {
  const h = harness({ failAt: 'SELECT id FROM signals WHERE organization_id=$1 AND id=$2 FOR KEY SHARE', releaseFails: true });
  await assert.rejects(
    h.store.createDecision(actor, 'signal-id', { decision: 'monitor', rationale: 'synthetic test' }),
    (error) => error === h.originalError,
  );
  assert.ok(h.calls.includes('ROLLBACK'));
  assert.equal(h.wasReleased(), true);
});

test('connection release failure is still surfaced after a successful read', async () => {
  const calls = [];
  const connection = {
    async query(sql) {
      calls.push(sql);
      if (sql === 'SELECT id FROM signals WHERE organization_id=$1 AND id=$2') return { rows: [] };
      return { rows: [] };
    },
    release() { throw new Error('release failed'); },
  };
  const store = new PostgresDecisionActionStore({ async connect() { return connection; } });
  await assert.rejects(store.listDecisions(actor, 'missing-signal', 10), /release failed/);
  assert.ok(calls.includes('COMMIT'));
});
