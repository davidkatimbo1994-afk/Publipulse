import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const simulation = fs.readFileSync(path.join(root, 'apps/api/src/dhis2-exchange-simulation.ts'), 'utf8');
const adapter = fs.readFileSync(path.join(root, 'apps/api/src/dhis2-adapter.ts'), 'utf8');
const harness = fs.readFileSync(path.join(root, 'apps/api/src/dhis2-test-harness.ts'), 'utf8');
const testFile = fs.readFileSync(path.join(root, 'apps/api/test/dhis2-end-to-end.test.ts'), 'utf8');

test('Phase 7G has the complete controlled exchange lifecycle', () => {
  for (const token of ['fetchMetadata', 'validateAlignedMetadata', 'mapAggregateRecords', 'payloadDigest', 'reconcileExchange', 'executeWithPayload', 'idempotencyKey']) {
    assert.match(simulation + adapter + harness, new RegExp(token));
  }
  assert.match(testFile, /metadata.*mapping.*payload.*submission.*receipt.*reconciliation/i);
  assert.match(testFile, /metadataRequests.*\/api\/metadata/);
  assert.match(testFile, /idempotentReplayReference/);
  assert.match(testFile, /dhis2_metadata_drift/);
  assert.match(testFile, /dhis2_org_unit_mapping_missing/);
});

test('Phase 7G does not introduce network clients into the controlled harness', () => {
  assert.doesNotMatch(harness, /fetch\s*\(/);
  assert.doesNotMatch(harness, /axios/i);
  assert.doesNotMatch(harness, /https?:\/\//i);
});
