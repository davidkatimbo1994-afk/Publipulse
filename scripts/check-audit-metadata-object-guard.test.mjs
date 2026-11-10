import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const migration = await readFile(new URL('apps/api/migrations/009_audit_metadata_object_guard.sql', root), 'utf8');
const harness = await readFile(new URL('apps/api/test/sql/rls.integration.sql', root), 'utf8');
const storePaths = [
  'apps/api/src/postgres-signal-store.ts',
  'apps/api/src/postgres-evidence-store.ts',
  'apps/api/src/postgres-investigation-store.ts',
  'apps/api/src/postgres-decision-action-store.ts',
];
const stores = await Promise.all(storePaths.map((path) => readFile(new URL(path, root), 'utf8')));

test('audit metadata has a database-enforced JSON object constraint', () => {
  assert.match(migration, /ADD CONSTRAINT audit_events_metadata_object_check/);
  assert.match(migration, /CHECK\s*\(jsonb_typeof\(metadata\)\s*=\s*'object'\)/i);
  assert.match(migration.trimStart().replace(/^--.*(?:\n|$)/gm, '').trimStart(), /^BEGIN\s*;/i);
  assert.match(migration.trim(), /COMMIT;$/i);
});

test('PostgreSQL integration harness asserts and exercises the metadata shape constraint', () => {
  assert.match(harness, /audit_events_metadata_object_check/);
  assert.match(harness, /pg_get_constraintdef\(con\.oid\)/);
  assert.match(harness, /metadata_shape_rejected/);
  assert.match(harness, /EXCEPTION WHEN check_violation/);
});

test('application audit writes serialize object-shaped metadata', () => {
  let writes = 0;
  for (const source of stores) {
    for (const match of source.matchAll(/INSERT INTO audit_events[\s\S]*?JSON\.stringify\(\{([\s\S]*?)\}\)/g)) {
      assert.ok(match[1].trim().length > 0, 'audit metadata object should not be empty by accident');
      writes += 1;
    }
  }
  assert.ok(writes >= 8, `expected to inspect audit writes, inspected ${writes}`);
});
