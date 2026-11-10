import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = fileURLToPath(new URL('../', import.meta.url));
const sql = fs.readFileSync(new URL('../apps/api/migrations/019_outcome_intelligence.sql', import.meta.url),'utf8');
test('outcome intelligence migration contains closure integrity, recurrence and expert learning structures',()=>{
  assert.match(sql,/outcome_case_reviews/); assert.match(sql,/recurrence_patterns/); assert.match(sql,/expert_recommendations/);
  assert.match(sql,/CLOSED_WITHOUT_RESOLUTION|resolution_unverified/); assert.match(sql,/FORCE ROW LEVEL SECURITY/); assert.match(sql,/append-only/);
});
