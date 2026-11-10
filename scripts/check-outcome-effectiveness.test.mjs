import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const shared = fs.readFileSync(new URL('../packages/shared/src/outcome-effectiveness.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../apps/api/migrations/022_outcome_effectiveness_learning.sql', import.meta.url), 'utf8');
const integrityMigration = fs.readFileSync(new URL('../apps/api/migrations/023_outcome_effectiveness_integrity.sql', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('effectiveness learning preserves bounded non-causal classifications', () => {
  assert.match(shared, /supported/);
  assert.match(shared, /mixed/);
  assert.match(shared, /not_supported/);
  assert.match(shared, /insufficient_evidence/);
  assert.match(shared, /without claiming causation/);
});

test('persistent problem model distinguishes intervention resistance', () => {
  assert.match(shared, /intervention_resistant/);
  assert.match(shared, /distinctInterventionsTried/);
  assert.match(shared, /recurrenceAfterActionCount/);
});

test('effectiveness integrity migration bounds persisted counts without mutating the prior migration', () => {
  assert.match(integrityMigration, /unresolved_count <= occurrence_count/);
  assert.match(integrityMigration, /recurrence_after_action_count <= occurrence_count/);
  assert.match(integrityMigration, /ALTER TABLE intervention_learning_summaries/);
});

test('effectiveness persistence is tenant isolated and append-only', () => {
  assert.match(migration, /intervention_learning_summaries/);
  assert.match(migration, /persistent_problem_assessments/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /append-only/);
});

test('product documentation remains outcome-first', () => {
  assert.match(readme, /Outcome Effectiveness & Persistent-Problem Learning/);
  assert.match(readme, /administrative closure is not treated as proof of resolution/i);
});
