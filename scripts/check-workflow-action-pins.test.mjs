import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { findUnpinnedActions, verifyWorkflowActionPins } from './check-workflow-action-pins.mjs';

const rootDir = fileURLToPath(new URL('../.github/workflows/', import.meta.url));

test('action pin validator rejects floating tags, branches, and abbreviated hashes', () => {
  const failures = findUnpinnedActions([
    'steps:',
    '  - uses: actions/checkout@v4',
    '  - uses: org/action@main',
    '  - uses: org/action@123abc',
    '  - uses: org/action@11bd71901bbe5b1630ceea73d27597364c9af683 # pinned',
  ].join('\n'));
  assert.equal(failures.length, 3);
});

test('all repository workflow action references are pinned to full commit SHAs', async () => {
  const result = await verifyWorkflowActionPins(rootDir);
  assert.equal(result.filesChecked, 2);
  assert.deepEqual(result.failures, []);
});
