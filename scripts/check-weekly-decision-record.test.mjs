import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const route = await readFile(join(root, 'apps/api/src/learning-routes.ts'), 'utf8');
const store = await readFile(join(root, 'apps/api/src/postgres-learning-store.ts'), 'utf8');
const schema = await readFile(join(root, 'packages/shared/src/weekly-decision.ts'), 'utf8');
const migration = await readFile(join(root, 'apps/api/migrations/035_weekly_review_decisions.sql'), 'utf8');
const idempotencyMigration = await readFile(join(root, 'apps/api/migrations/036_weekly_decision_idempotency.sql'), 'utf8');

test('weekly decision record is role-gated and append-only', () => {
  assert.match(route, /canRecordWeeklyDecision\(actor\)/);
  assert.match(route, /POST.*weekly-decision|app\.post\('\/v1\/learning\/weekly-decision'/s);
  assert.match(store, /recordWeeklyDecision/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /BEFORE UPDATE OR DELETE/);
});

test('weekly decision captures bounded human learning choices', () => {
  assert.match(schema, /continue_current_approach/);
  assert.match(schema, /change_approach/);
  assert.match(schema, /escalate_programme_redesign/);
  assert.match(schema, /insufficient_evidence/);
  assert.match(schema, /nextCheckAt/);
  assert.match(schema, /assertPublicHealthNarrative/);
});


test('weekly decisions are replay-safe per organization', () => {
  assert.match(schema, /clientMutationId/);
  assert.match(store, /client_mutation_id/);
  assert.match(idempotencyMigration, /weekly_review_decisions_org_mutation_uidx/);
  assert.match(idempotencyMigration, /client_mutation_id SET NOT NULL/);
});
