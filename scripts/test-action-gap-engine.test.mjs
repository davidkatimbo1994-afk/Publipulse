import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateActionGaps, ACTION_GAP_RULES } from '../apps/web/src/action-gap-engine.js';

const NOW = Date.parse('2026-10-12T08:00:00.000Z');
const base = {
  id: 'synthetic-1', title: 'Synthetic district concern', district: 'Demo District',
  createdAt: '2026-10-10T00:00:00.000Z', stage: 'signal', status: 'open',
  owner: '', verifiedAt: null, dueAt: null, blocker: '', outcomeEvidence: '',
  evidenceQuality: 'preliminary', recurrences: 0
};

test('rules are transparent and have unique identifiers', () => {
  assert.ok(ACTION_GAP_RULES.length >= 7);
  assert.equal(new Set(ACTION_GAP_RULES.map(rule => rule.code)).size, ACTION_GAP_RULES.length);
  assert.ok(ACTION_GAP_RULES.every(rule => rule.weight > 0 && rule.detail.length > 10));
});

test('flags an unverified signal after 48 hours without declaring a health event', () => {
  const [result] = evaluateActionGaps([base], NOW);
  assert.ok(result.gapReasons.some(reason => reason.code === 'UNVERIFIED'));
  assert.match(result.nextStep, /authorized verifier/i);
  assert.equal(result.status, 'open');
});

test('prioritizes combined owner, overdue, blocker and missing outcome gaps', () => {
  const urgent = { ...base, id: 'synthetic-urgent', stage: 'response', status: 'blocked', dueAt: '2026-10-01T00:00:00.000Z', blocker: 'Transport unavailable', recurrences: 1 };
  const clear = { ...base, id: 'synthetic-clear', createdAt: '2026-10-12T07:00:00.000Z', verifiedAt: '2026-10-12T07:30:00.000Z', stage: 'signal', owner: 'Duty officer' };
  const results = evaluateActionGaps([clear, urgent], NOW);
  assert.equal(results[0].id, 'synthetic-urgent');
  assert.ok(results[0].gapScore >= results[1].gapScore);
  assert.ok(results[0].gapReasons.some(reason => reason.code === 'NO_OWNER'));
  assert.ok(results[0].gapReasons.some(reason => reason.code === 'OVERDUE'));
  assert.ok(results[0].gapReasons.some(reason => reason.code === 'BLOCKED'));
});

test('completed work without outcome evidence is not treated as outcome verified', () => {
  const [result] = evaluateActionGaps([{ ...base, stage: 'response', status: 'completed', owner: 'Team lead', outcomeEvidence: '' }], NOW);
  assert.ok(result.gapReasons.some(reason => reason.code === 'NO_EVIDENCE'));
  assert.match(result.nextStep, /outcome as unknown/i);
});

test('rejects invalid input and caps score at 100', () => {
  assert.throws(() => evaluateActionGaps(null, NOW), /array/);
  const [result] = evaluateActionGaps([{ ...base, stage: 'response', status: 'blocked', blocker: 'x', dueAt: '2026-10-01T00:00:00.000Z', recurrences: 3, evidenceQuality: 'conflicting' }], NOW);
  assert.ok(result.gapScore <= 100);
});
