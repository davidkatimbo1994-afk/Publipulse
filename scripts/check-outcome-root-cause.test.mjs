import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const migration = fs.readFileSync(new URL('../apps/api/migrations/021_outcome_root_cause_learning.sql', import.meta.url), 'utf8');
const shared = fs.readFileSync(new URL('../packages/shared/src/outcome-root-cause.ts', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8').toLowerCase();

test('root-cause learning is tenant isolated and append-only',()=>{
  assert.match(migration,/recurrence_cluster_assessments/); assert.match(migration,/root_cause_hypotheses/); assert.match(migration,/root_cause_hypothesis_reviews/); assert.match(migration,/FORCE ROW LEVEL SECURITY/); assert.match(migration,/append-only/);
});
test('root-cause contract preserves competing evidence and uncertainty',()=>{
  assert.match(shared,/supportingEvidence/); assert.match(shared,/disconfirmingEvidence/); assert.match(shared,/confidence/); assert.match(shared,/not_supported/); assert.match(shared,/causal inference/);
});
