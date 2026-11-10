import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const runtime = String.raw`
import assert from 'node:assert/strict';
import { PostgresAuditStore } from './apps/api/src/postgres-audit-store.ts';
const actor = { organizationId: 'org-verified', userId: 'user-1', roles: ['auditor'] };
const calls = [];
const pool = { async connect() { return { async query(sql, values = []) { calls.push({sql, values}); if (sql.startsWith('SELECT id::text')) return {rows:[{id:'8',actor_user_id:'user-2',action:'signal.updated',resource_type:'signal',resource_id:'resource-1',outcome:'success',occurred_at:'2026-10-11T12:00:00.000Z'}]}; return {rows:[]}; }, release() { calls.push({sql:'RELEASE'}); } }; } };
const store = new PostgresAuditStore(pool);
const rows = await store.list(actor, 11, {occurredAt:'2026-10-11T13:00:00.000Z', id:'9'});
assert.equal(rows.length, 1);
assert.deepEqual(rows[0], {id:'8',actorUserId:'user-2',action:'signal.updated',resourceType:'signal',resourceId:'resource-1',outcome:'success',occurredAt:'2026-10-11T12:00:00.000Z'});
assert.equal(calls[0].sql, 'BEGIN');
assert.match(calls[1].sql, /set_config\('app.organization_id', \$1, true\)/);
assert.deepEqual(calls[1].values, ['org-verified']);
assert.match(calls[2].sql, /WHERE organization_id = \$1 AND \(occurred_at, id\) < \(\$2::timestamptz, \$3::bigint\)/);
assert.match(calls[2].sql, /ORDER BY occurred_at DESC, id DESC LIMIT \$4/);
assert.deepEqual(calls[2].values, ['org-verified','2026-10-11T13:00:00.000Z','9',11]);
assert.doesNotMatch(calls[2].sql, /metadata/i);
assert.equal(calls[3].sql, 'COMMIT');
assert.equal(calls[4].sql, 'RELEASE');

const failedCalls = [];
const primary = new Error('query failed');
const failingStore = new PostgresAuditStore({ async connect() { return { async query(sql) { failedCalls.push(sql); if (sql.startsWith('SELECT id::text')) throw primary; return {rows:[]}; }, release() { failedCalls.push('RELEASE'); } }; } });
await assert.rejects(() => failingStore.list(actor, 5), (error) => error === primary);
assert.deepEqual(failedCalls, ['BEGIN', "SELECT set_config('app.organization_id', $1, true)", 'SELECT id::text, actor_user_id::text, action, resource_type, resource_id::text, outcome, occurred_at FROM audit_events WHERE organization_id = $1 ORDER BY occurred_at DESC, id DESC LIMIT $2', 'ROLLBACK', 'RELEASE']);
`;

test('PostgreSQL audit store scopes, projects and paginates rows and cleans up failed transactions', () => {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', runtime], {
    cwd: process.cwd(), encoding: 'utf8'
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
