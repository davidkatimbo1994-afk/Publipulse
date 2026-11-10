import { readWebSource } from './lib/web-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = readWebSource();

test('outcome assessment preview captures measurement, result, evidence and uncertainty', () => {
  for (const field of ['Indicator name', 'Baseline value', 'Target value', 'Follow-up value', 'Assessment result', 'Evidence source and summary', 'Uncertainty / limitations']) {
    assert.ok(source.includes(field), `missing UI field: ${field}`);
  }
  for (const result of ['improved', 'no_change', 'worsened', 'inconclusive']) assert.ok(source.includes(result));
});

test('outcome preview discloses session-only behavior and does not imply server persistence', () => {
  assert.match(source, /not sent to the PubliPulse API/);
  assert.match(source, /lost on refresh/);
  assert.match(source, /Session-only · Not an authoritative audit log/);
});

test('conclusive assessments require follow-up and inconclusive assessments require uncertainty', () => {
  assert.match(source, /outcomeForm\.result !== 'inconclusive' && outcomeForm\.followUp\.trim\(\) === ''/);
  assert.match(source, /outcomeForm\.result === 'inconclusive' && outcomeForm\.uncertainty\.trim\(\) === ''/);
});
