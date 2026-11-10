import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

test('outcome decay and resource-intelligence foundations are present and bounded', async () => {
  const migration = await readFile(join(root, 'apps/api/migrations/026_outcome_decay_resource_feedback.sql'), 'utf8');
  const learningStore = await readFile(join(root, 'apps/api/src/learning-store.ts'), 'utf8');
  const postgresLearning = await readFile(join(root, 'apps/api/src/postgres-learning-store.ts'), 'utf8');
  const routes = await readFile(join(root, 'apps/api/src/learning-routes.ts'), 'utf8');
  const shared = await readFile(join(root, 'packages/shared/src/outcome-decay.ts'), 'utf8');
  assert.match(migration, /reporter_feedback_events/);
  assert.match(migration, /persistent_problem_learning_decisions/);
  assert.match(migration, /blocker_type/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /append-only/);
  assert.match(learningStore, /outcomeDecay/);
  assert.match(postgresLearning, /action_gap_detections/);
  assert.match(postgresLearning, /percentile_cont/);
  assert.match(routes, /\/v1\/learning\/outcome-decay/);
  assert.match(shared, /OutcomeDecaySnapshot|OutcomeDecayStageSchema/);
});
