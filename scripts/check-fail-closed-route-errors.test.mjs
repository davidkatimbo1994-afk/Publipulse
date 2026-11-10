import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../apps/api/src/app.ts', import.meta.url), 'utf8');
const apiTestSource = await readFile(new URL('../apps/api/test/app.test.ts', import.meta.url), 'utf8');

test('unconfigured investigation routes keep their own fail-closed error', () => {
  assert.match(appSource, /const unavailableInvestigation[\s\S]*?investigation_service_not_configured/);
  assert.match(appSource, /url: '\/v1\/signals\/:signalId\/investigations'[\s\S]*?handler: unavailableInvestigation/);
});

test('unconfigured decision and action routes report decision-action service failure', () => {
  assert.match(appSource, /const unavailableDecisionAction[\s\S]*?decision_action_service_not_configured/);
  assert.match(appSource, /url: '\/v1\/signals\/:signalId\/decisions'[\s\S]*?handler: unavailableDecisionAction/);
  assert.match(appSource, /url: '\/v1\/signals\/:signalId\/actions'[\s\S]*?handler: unavailableDecisionAction/);
  assert.match(appSource, /url: '\/v1\/actions\/:actionId'[\s\S]*?handler: unavailableDecisionAction/);
  assert.match(apiTestSource, /returns service-specific fail-closed errors for unconfigured workflow stages/);
});
