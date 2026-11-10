import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const sql = fs.readFileSync(new URL('../apps/api/migrations/020_outcome_learning_evaluations.sql', import.meta.url), 'utf8');
const shared = fs.readFileSync(new URL('../packages/shared/src/outcome-learning.ts', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8').toLowerCase();

test('outcome learning migration is append-only and tenant isolated', () => {
  assert.match(sql, /outcome_review_tasks/);
  assert.match(sql, /expert_recommendation_reviews/);
  assert.match(sql, /intervention_evaluations/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /outcome learning records are append-only/);
});

test('outcome learning contract preserves uncertainty and recurrence', () => {
  assert.match(shared, /closed_without_resolution/);
  assert.match(shared, /recurring_after_action/);
  assert.match(shared, /requiresExpertReview/);
  assert.match(shared, /insufficient_evidence/);
  assert.match(shared, /mixed/);
});

