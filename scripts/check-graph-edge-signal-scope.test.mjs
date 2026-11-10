import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const migrationPath = fileURLToPath(new URL('../apps/api/migrations/007_graph_edge_signal_scope.sql', import.meta.url));
const migration = await readFile(migrationPath, 'utf8');
const storePath = fileURLToPath(new URL('../apps/api/src/postgres-decision-action-store.ts', import.meta.url));
const store = await readFile(storePath, 'utf8');

test('workflow graph edges are constrained to a single signal in the database', () => {
  assert.match(migration, /CREATE FUNCTION enforce_graph_edge_signal_scope\(\)/);
  for (const nodeType of ['signal', 'evidence', 'investigation', 'decision', 'action', 'outcome']) {
    assert.match(migration, new RegExp(`WHEN '${nodeType}' THEN`), `missing endpoint resolution for ${nodeType}`);
  }
  assert.match(migration, /NEW\.relation <> 'related_to'/);
  assert.match(migration, /from_signal_id <> to_signal_id/);
  assert.match(migration, /ERRCODE = '23514'/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OF organization_id, from_type, from_id, relation, to_type, to_id/);
});

test('existing decision and action workflow edges satisfy the same-signal invariant', () => {
  assert.match(store, /'signal',[\s\S]{0,60}'decides','decision'/);
  assert.match(store, /'decision',[\s\S]{0,60}'triggers','action'/);
  assert.match(store, /'signal',[\s\S]{0,60}'triggers','action'/);
});
