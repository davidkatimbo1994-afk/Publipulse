import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sqlPath = fileURLToPath(new URL('../apps/api/test/sql/rls.integration.sql', import.meta.url));
const sql = await readFile(sqlPath, 'utf8');

test('PostgreSQL RLS harness checks all ten protected tables and policy predicates', () => {
  for (const table of [
    'organizations', 'organization_memberships', 'signals', 'evidence',
    'investigations', 'decisions', 'response_actions', 'outcomes',
    'graph_edges', 'audit_events',
  ]) {
    assert.ok(sql.includes(`'${table}'`), `missing protected-table assertion for ${table}`);
  }
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /relforcerowsecurity/);
  assert.match(sql, /p\.policyname NOT IN \('tenant_isolation'/);
  assert.match(sql, /p\.permissive = 'PERMISSIVE'/);
  assert.match(sql, /p\.cmd = 'ALL'/);
  assert.match(sql, /p\.qual/);
  assert.match(sql, /p\.with_check/);
  assert.match(sql, /Unexpected additional RLS policy/);
  assert.match(sql, /aclexplode\(coalesce\(c\.relacl, acldefault/);
  assert.match(sql, /acl\.grantee = 0/);
  assert.match(sql, /PUBLIC has table privileges on protected table/);
});

test('PostgreSQL RLS harness rejects elevated or role-inheriting integration roles', () => {
  assert.match(sql, /NOT rolsuper AND NOT rolbypassrls/);
  assert.match(sql, /NOT rolcreatedb AND NOT rolcreaterole/);
  assert.match(sql, /pg_auth_members/);
  assert.match(sql, /must not inherit or be able to SET ROLE/);
});


test('PostgreSQL RLS harness checks cross-tenant row invisibility across tenant tables', () => {
  assert.match(sql, /Verify that rows belonging to tenant two are invisible across every table/);
  assert.match(sql, /'organization_memberships', 'signals', 'evidence', 'investigations'/);
  assert.match(sql, /'decisions', 'response_actions', 'outcomes', 'graph_edges', 'audit_events'/);
  assert.match(sql, /WHERE organization_id = \$1/);
  assert.match(sql, /RLS exposed tenant-two rows in public\.%/);
});


test('PostgreSQL RLS harness rejects all unreviewed extra policies, including restrictive policies', () => {
  assert.match(sql, /Either kind of unreviewed policy can change the security or availability contract/);
  assert.match(sql, /p\.policyname NOT IN \(.*interoperability_exchange_envelopes_tenant/);
  assert.doesNotMatch(sql, /p\.policyname <> 'tenant_isolation' AND p\.permissive = 'PERMISSIVE'/);
});


test('decision/action transaction setup rolls back and releases its connection on setup failure', async () => {
  const storePath = fileURLToPath(new URL('../apps/api/src/postgres-decision-action-store.ts', import.meta.url));
  const store = await readFile(storePath, 'utf8');
  assert.match(store, /private async begin\(actor:VerifiedActor\)\s*\{[\s\S]*?try\s*\{[\s\S]*?await c\.query\('BEGIN'\)[\s\S]*?set_config\('app\.organization_id',[\s\S]*?catch\(error\)\s*\{[\s\S]*?await c\.query\('ROLLBACK'\)[\s\S]*?c\.release\(\)[\s\S]*?throw error/);
});


test('decision/action transaction setup preserves the original failure if cleanup also fails', async () => {
  const storePath = fileURLToPath(new URL('../apps/api/src/postgres-decision-action-store.ts', import.meta.url));
  const store = await readFile(storePath, 'utf8');
  assert.match(store, /catch\(error\)\s*\{[\s\S]*?try\s*\{\s*await c\.query\('ROLLBACK'\)\s*\}catch\{\}\s*try\s*\{c\.release\(\)\}catch\{\}\s*throw error/);
});


test('PostgreSQL RLS harness verifies the enabled audit TRUNCATE trigger and exercises it under an over-granted role', () => {
  assert.match(sql, /GRANT SELECT, UPDATE, DELETE, TRUNCATE ON audit_events TO publipulse_audit_mutator_test/);
  assert.match(sql, /t\.tgname = 'audit_events_no_truncate'[\s\S]*?t\.tgtype & 32 = 32/);
  assert.match(sql, /EXECUTE 'TRUNCATE TABLE audit_events'/);
  assert.match(sql, /EXCEPTION WHEN insufficient_privilege/);
  assert.match(sql, /audit_events are append-only/);
  assert.match(sql, /Audit row missing after rejected TRUNCATE/);
});


test('PostgreSQL RLS harness enforces a column-limited audit reader role', () => {
  assert.match(sql, /CREATE ROLE publipulse_audit_reader_test LOGIN PASSWORD 'audit-reader-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT/);
  assert.match(sql, /GRANT SELECT \(id, actor_user_id, action, resource_type, resource_id, outcome, occurred_at\) ON audit_events TO publipulse_audit_reader_test/);
  assert.match(sql, /has_column_privilege\('publipulse_audit_reader_test', 'public\.audit_events', 'metadata', 'SELECT'\)/);
  assert.match(sql, /SET LOCAL ROLE publipulse_audit_reader_test[\s\S]*?Audit-reader RLS expected one tenant-one event[\s\S]*?Audit-reader unexpectedly selected raw metadata/);
});
