import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require('typescript');
} catch {
  ts = (() => { throw new Error('The typescript package is not installed. Run `npm ci` at the repository root, then re-run the tests.'); })();
}
const source = await (await import('node:fs/promises')).readFile(new URL('../apps/api/src/postgres-pool-health.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { checkPostgresClient } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('readiness probe releases client after a successful connectivity query', async () => {
  const calls = [];
  const client = { async query(sql) { calls.push(sql); }, release() { calls.push('release'); } };
  assert.equal(await checkPostgresClient(client), true);
  assert.deepEqual(calls, ['SELECT 1', 'release']);
});

test('readiness probe preserves the query error if release also fails', async () => {
  const queryError = new Error('database unavailable');
  const client = { async query() { throw queryError; }, release() { throw new Error('release failed'); } };
  await assert.rejects(checkPostgresClient(client), (error) => error === queryError);
});

test('readiness probe surfaces a release failure after a successful query', async () => {
  const releaseError = new Error('release failed');
  const client = { async query() {}, release() { throw releaseError; } };
  await assert.rejects(checkPostgresClient(client), (error) => error === releaseError);
});

test('pool readiness delegates checked-out client cleanup to the tested helper', async () => {
  const poolSource = await (await import('node:fs/promises')).readFile(new URL('../apps/api/src/postgres-pool.ts', import.meta.url), 'utf8');
  assert.match(poolSource, /return checkPostgresClient\(await this\.pool\.connect\(\)\)/);
});


test('PostgreSQL pool bounds client and server query execution time', async () => {
  const poolSource = await (await import('node:fs/promises')).readFile(new URL('../apps/api/src/postgres-pool.ts', import.meta.url), 'utf8');
  assert.match(poolSource, /query_timeout:\s*5_000/);
  assert.match(poolSource, /statement_timeout:\s*5_000/);
  assert.match(poolSource, /connectionTimeoutMillis:\s*5_000/);
});
