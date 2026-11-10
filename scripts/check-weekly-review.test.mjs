import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shared = readFileSync('packages/shared/src/weekly-review.ts','utf8');
const store = readFileSync('apps/api/src/postgres-learning-store.ts','utf8');
const routes = readFileSync('apps/api/src/learning-routes.ts','utf8');

test('weekly review has bounded priority classification and privacy-safe interpretation', () => {
  assert.match(shared, /classifyWeeklyReviewPriority/);
  assert.match(shared, /unresolved_outcomes/);
  assert.match(shared, /persistent_recurrence/);
  assert.match(shared, /response_blockers/);
  assert.match(shared, /ownership_gaps/);
  assert.match(shared, /does not establish outbreak status, clinical risk, causation, or intervention effectiveness/);
});

test('weekly review store is tenant scoped and suppresses small district cells', () => {
  assert.match(store, /set_config\('app\.organization_id'/);
  assert.match(store, /HAVING COUNT\(\*\) >= \$4/);
  assert.match(store, /weeklyReview\(actor/);
});

test('weekly review route requires identity and strict minimum-cell validation', () => {
  assert.match(routes, /\/v1\/learning\/weekly-review/);
  assert.match(routes, /authentication_required/);
  assert.match(routes, /insufficient_permissions/);
  assert.match(routes, /invalid_weekly_review_parameters/);
  assert.match(routes, /invalid_weekly_review_window/);
});
