import { readWebSource } from './lib/web-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readWebSource();
const routes = readFileSync(new URL('../apps/api/src/outcome-routes.ts', import.meta.url), 'utf8');

test('outcome UI uses authenticated API endpoints for persisted assessments', () => {
  assert.match(ui, /\/v1\/signals\/\$\{encodeURIComponent\(apiConfig\.signalId\.trim\(\)\)\}\/outcomes/);
  assert.match(ui, /Authorization: `Bearer \$\{apiConfig\.accessToken\}`/);
  assert.match(ui, /'x-organization-id': apiConfig\.organizationId\.trim\(\)/);
  assert.match(ui, /Save assessment to API/);
  assert.match(routes, /canCreateOutcomeAssessment\(actor\)/);
  assert.match(routes, /canReadOutcomeAssessments\(actor\)/);
});

test('API credentials are not persisted in browser storage and demo IDs remain separate', () => {
  assert.doesNotMatch(ui, /localStorage|sessionStorage/);
  assert.match(ui, /Demo case IDs above are synthetic and are not sent to the server/);
  assert.match(ui, /setApiConfig\(\{baseUrl:'',organizationId:'',accessToken:'',signalId:'',actionId:''\}\)/);
});

test('outcome panel exposes evidence, baseline, target, follow-up and uncertainty inputs', () => {
  for (const field of ['baselineValue', 'targetValue', 'followUpValue', 'evidenceSummary', 'evidenceReference', 'uncertaintyNote']) {
    assert.match(ui, new RegExp(`name="${field}"`), `missing ${field} input`);
  }
  assert.match(ui, /inconclusive/);
  assert.match(ui, /Clear connection/);
});
