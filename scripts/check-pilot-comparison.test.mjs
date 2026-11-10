import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const routes = fs.readFileSync('apps/api/src/learning-routes.ts','utf8');

test('pilot comparison route requires explicit baseline and pilot windows', () => {
  assert.match(routes, /baselineStart\?: string; baselineEnd\?: string; pilotStart\?: string; pilotEnd\?: string/);
  assert.match(routes, /invalid_pilot_comparison_window/);
});

test('pilot comparison exposes outcome completeness and conservative interpretation', () => {
  assert.match(routes, /outcomeMeasurementCompleteness/);
  assert.match(routes, /durableOutcomeCompleteness/);
  assert.match(routes, /Differences do not establish causation, clinical effectiveness, or superiority/);
});

test('pilot comparison preserves minimum-cell privacy boundary', () => {
  assert.match(routes, /minimumSignalCell: minCell/);
  assert.match(routes, /individualRecordsExcluded: true/);
});
