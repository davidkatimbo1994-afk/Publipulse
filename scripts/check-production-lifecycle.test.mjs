import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('audit metadata has database-level direct-identifier guard', async () => {
  const source = await readFile(new URL('apps/api/migrations/028_audit_lifecycle_hardening.sql', root), 'utf8');
  assert.match(source, /reject_sensitive_audit_metadata/);
  assert.match(source, /audit_events_no_common_direct_identifier/);
  assert.match(source, /USING \(organization_id = nullif\(current_setting\('app\.organization_id'/);
});

test('retention policies are bounded and tenant scoped', async () => {
  const source = await readFile(new URL('apps/api/migrations/028_audit_lifecycle_hardening.sql', root), 'utf8');
  assert.match(source, /retention_days integer NOT NULL CHECK \(retention_days BETWEEN 1 AND 36500\)/);
  assert.match(source, /UNIQUE \(organization_id, data_class\)/);
  assert.match(source, /ALTER TABLE data_retention_policies FORCE ROW LEVEL SECURITY/);
});

test('interoperability idempotency replay compares persisted contract fingerprint', async () => {
  const source = await readFile(new URL('apps/api/src/postgres-interoperability-store.ts', root), 'utf8');
  assert.match(source, /j\.contract_fingerprint/);
  assert.match(source, /x\.contract_fingerprint !== fingerprint/);
});
