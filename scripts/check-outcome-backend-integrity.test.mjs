import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../apps/api/src/outcome-routes.ts', import.meta.url), 'utf8');
const store = readFileSync(new URL('../apps/api/src/postgres-outcome-store.ts', import.meta.url), 'utf8');
const contract = readFileSync(new URL('../packages/shared/src/outcome-assessment.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../apps/api/migrations/011_outcome_evidence_accountability.sql', import.meta.url), 'utf8');
const app = readFileSync(new URL('../apps/api/src/app.ts', import.meta.url), 'utf8');

test('outcome API validates auth, role, signal UUID and bounded list size before storage', () => {
  assert.match(route, /if\(!actor\)return reply\.code\(401\)/);
  assert.match(route, /canCreateOutcomeAssessment\(actor\)/);
  assert.match(route, /canReadOutcomeAssessments\(actor\)/);
  assert.match(route, /!UUID\.test\(signalId\)/);
  assert.match(route, /parseQueryLimit/);
  assert.match(route, /safeParse\(req\.body\)/);
});

test('outcome persistence scopes signal and action to the actor organization and same signal', () => {
  assert.match(store, /set_config\('app\.organization_id',\$1,true\)/);
  assert.match(store, /FROM signals WHERE organization_id=\$1 AND id=\$2/);
  assert.match(store, /FROM response_actions WHERE organization_id=\$1 AND signal_id=\$2 AND id=\$3/);
  assert.match(store, /INSERT INTO outcomes/);
  assert.match(store, /INSERT INTO graph_edges/);
  assert.match(store, /INSERT INTO audit_events/);
  assert.match(store, /await c\.query\('COMMIT'\)/);
  assert.match(store, /await c\.query\('ROLLBACK'\)/);
  assert.match(store, /finally\{c\.release\(\);\}/);
});

test('outcome contract requires evidence and uncertainty for inconclusive findings', () => {
  assert.match(contract, /evidenceSummary: publicHealthNarrative\(z\.string\(\)\.trim\(\)\.min\(5\)/);
  assert.match(contract, /result: z\.enum\(\['improved', 'no_change', 'worsened', 'inconclusive'\]\)/);
  assert.match(contract, /value\.result === 'inconclusive'/);
  assert.match(contract, /uncertaintyNote/);
  assert.match(contract, /\)\.strict\(\)/);
});

test('migration preserves old rows while constraining new assessment metadata', () => {
  assert.match(migration, /ADD COLUMN target_value numeric/);
  assert.match(migration, /assessment_result IN \('improved','no_change','worsened','inconclusive'\)/);
  assert.match(migration, /CREATE INDEX outcomes_org_action_measured_idx/);
  assert.match(migration, /BEGIN;/);
  assert.match(migration, /COMMIT;/);
});

test('outcome endpoints fail closed when no persistence store is configured', () => {
  assert.match(app, /unavailableOutcome/);
  assert.match(app, /outcome_service_not_configured/);
  assert.match(app, /options\.outcomeStore/);
});

test('PostgreSQL CI verifies outcome constraints, indexes and tenant isolation', () => {
  const sql = readFileSync(new URL('../apps/api/test/sql/verify_outcome_integrity.sql', import.meta.url), 'utf8');
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const readiness = readFileSync(new URL('./check-release-readiness.mjs', import.meta.url), 'utf8');
  assert.match(sql, /outcomes_assessment_result_check/);
  assert.match(sql, /outcomes_action_same_signal_fk/);
  assert.match(sql, /n\.nspname = current_schema\(\)/);
  assert.match(sql, /i\.relkind IN \('i', 'I'\)/);
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /tenant_isolation/);
  assert.match(ci, /verify_outcome_integrity\.sql/);
  assert.match(readiness, /apps\/api\/test\/sql\/verify_outcome_integrity\.sql/);
});
