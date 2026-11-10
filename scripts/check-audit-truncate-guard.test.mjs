import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const migrationPath = fileURLToPath(new URL('../apps/api/migrations/008_audit_truncate_guard.sql', import.meta.url));
const migration = await readFile(migrationPath, 'utf8');
const initialPath = fileURLToPath(new URL('../apps/api/migrations/001_initial_action_graph.sql', import.meta.url));
const initial = await readFile(initialPath, 'utf8');

test('audit log blocks TRUNCATE using the existing mutation-rejection function', () => {
  assert.match(migration, /CREATE TRIGGER audit_events_no_truncate\s+BEFORE TRUNCATE ON audit_events\s+FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation\(\)/i);
  assert.match(migration.replace(/^(?:\s*--[^\n]*(?:\n|$))+/gm, '').trimStart(), /^BEGIN\s*;/i);
  assert.match(migration, /COMMIT\s*;\s*$/i);
});

test('audit log still rejects row updates and deletes', () => {
  assert.match(initial, /CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events/i);
  assert.match(initial, /CREATE FUNCTION reject_audit_mutation\(\)/);
});

test('documentation preserves the need for restrictive runtime database privileges', () => {
  assert.match(migration, /runtime roles must still lack TRUNCATE and DDL privileges/i);
});
