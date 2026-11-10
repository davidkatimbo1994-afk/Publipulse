import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');
const [route, app, server] = await Promise.all([
  read('apps/api/src/audit-routes.ts'), read('apps/api/src/app.ts'), read('apps/api/src/server.ts')
]);

test('audit limit validation rejects ambiguous JavaScript coercions', () => {
  assert.match(route, /parseQueryLimit\(query\.limit\)/);
  assert.match(route, /invalid_limit/);
  assert.match(route, /parseQueryLimit/);
});

test('audit store is a required readiness dependency and status is visible', () => {
  assert.match(app, /decisionActionStore && options\.auditStore/);
  assert.match(app, /auditStore: options\.auditStore \? 'configured' : 'not_configured'/);
  assert.match(server, /auditStore: new PostgresAuditStore\(pool\)/);
});

test('readiness and audit parameter guardrails are documented', async () => {
  const readme = await read('README.md');
  const changelog = await read('CHANGELOG.md');
  assert.match(readme, /API list page-size query parameters use shared strict canonical decimal validation/);
  assert.match(changelog, /0\.50\.0 — Strict audit query parameters and readiness completeness/);
});
