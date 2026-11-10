import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

test('auditor membership is a persisted, explicitly allowed role', async () => {
  const migration = await read('apps/api/migrations/010_auditor_membership_role.sql');
  assert.match(migration, /DROP CONSTRAINT organization_memberships_role_check/);
  assert.match(migration, /'read_only','auditor'/);
  assert.match(migration, /BEGIN;/);
  assert.match(migration, /COMMIT;/);
});

test('OIDC resolver accepts only the roles defined by membership policy, including auditor', async () => {
  const resolver = await read('apps/api/src/auth/oidc-actor-resolver.ts');
  const migration = await read('apps/api/migrations/001_initial_action_graph.sql');
  const roleMigration = await read('apps/api/migrations/010_auditor_membership_role.sql');
  assert.match(resolver, /'owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only', 'auditor'/);
  assert.match(migration, /role IN \('owner','administrator','reviewer','investigator','responder','analyst','read_only'\)/);
  assert.match(roleMigration, /'owner','administrator','reviewer','investigator','responder','analyst','read_only','auditor'/);
});

test('PostgreSQL integration fixture proves auditor membership persists', async () => {
  const sql = await read('apps/api/test/sql/rls.integration.sql');
  assert.match(sql, /'20000000-0000-4000-8000-000000000003', 'auditor'/);
  assert.match(sql, /Persisted auditor membership role is not accepted/);
});
