import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sqlPath = fileURLToPath(new URL('../apps/api/test/sql/verify_audit_integrity_posture.sql', import.meta.url));
const ciPath = fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url));
const sql = await readFile(sqlPath, 'utf8');
const ci = await readFile(ciPath, 'utf8');

test('audit posture verifier requires enabled and forced RLS with tenant-scoped policy', () => {
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /relforcerowsecurity/);
  assert.match(sql, /policyname = 'tenant_isolation'/);
  assert.match(sql, /app\.organization_id/);
  assert.match(sql, /exactly one tenant-isolation policy/);
});

test('audit posture verifier checks enabled append-only UPDATE/DELETE and TRUNCATE guards', () => {
  assert.match(sql, /audit_events_no_update/);
  assert.match(sql, /audit_events_no_truncate/);
  assert.match(sql, /t\.tgenabled = 'O'/);
  assert.match(sql, /reject_audit_mutation\(\)'::regprocedure/);
});

test('audit posture verifier checks metadata constraint and rejects PUBLIC grants', () => {
  assert.match(sql, /audit_events_metadata_object_check/);
  assert.match(sql, /con\.convalidated/);
  assert.match(sql, /acl\.grantee = 0/);
  assert.match(sql, /PUBLIC has table privileges/);
  assert.match(sql, /not a cryptographic authenticity guarantee/);
});

test('PostgreSQL CI runs the reusable audit posture verifier after tenant integration checks', () => {
  assert.match(ci, /psql[^\n]*-f apps\/api\/test\/sql\/verify_audit_integrity_posture\.sql/);
});
