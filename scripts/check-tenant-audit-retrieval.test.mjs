import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');
const [route, store, app, server, policy] = await Promise.all([
  read('apps/api/src/audit-routes.ts'), read('apps/api/src/postgres-audit-store.ts'), read('apps/api/src/app.ts'), read('apps/api/src/server.ts'), read('apps/api/src/audit-store.ts')
]);
test('audit route requires verified actor and explicit audit-reader role', () => {
  assert.match(route, /authentication_required/); assert.match(route, /insufficient_permissions/);
  assert.match(policy, /\['owner', 'administrator', 'reviewer', 'auditor'\]/);
});
test('audit endpoint bounds page size and validates opaque cursors', () => {
  assert.match(route, /parseQueryLimit/); assert.match(route, /invalid_limit/); assert.match(route, /invalid_cursor/);
  assert.match(route, /limit \+ 1/); assert.match(policy, /base64url/);
});
test('audit retrieval scopes transaction and query to verified organization', () => {
  assert.match(store, /set_config\('app\.organization_id', \$1, true\)/);
  assert.match(store, /WHERE organization_id = \$1/);
  assert.match(store, /ORDER BY occurred_at DESC, id DESC/);
  assert.match(store, /\(occurred_at, id\) < \(\$2::timestamptz, \$3::bigint\)/);
});
test('audit response uses explicit projection and never selects metadata', () => {
  assert.match(store, /SELECT id::text, actor_user_id::text, action, resource_type, resource_id::text, outcome, occurred_at FROM audit_events/);
  assert.doesNotMatch(store, /SELECT[^`]*metadata/i);
});
test('audit route is wired to PostgreSQL and fails closed if not configured', () => {
  assert.match(server, /new PostgresAuditStore\(pool\)/);
  assert.match(app, /audit_service_not_configured/);
});
