import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const harness = fs.readFileSync(`${root}/apps/api/src/dhis2-test-harness.ts`, 'utf8');
const adapter = fs.readFileSync(`${root}/apps/api/src/dhis2-adapter.ts`, 'utf8');
const routes = fs.readFileSync(`${root}/apps/api/src/interoperability-routes.ts`, 'utf8');

test('Phase 7E harness is deterministic and test-only', () => {
  assert.match(harness, /ControlledDhis2HttpClient/);
  assert.match(harness, /in-memory/);
  assert.match(harness, /Bearer test-/);
  assert.doesNotMatch(harness, /fetch\(/);
  assert.doesNotMatch(harness, /axios/);
  assert.match(adapter, /Dhis2Adapter/);
  assert.match(routes, /externalTransferPerformed:false/);
});
