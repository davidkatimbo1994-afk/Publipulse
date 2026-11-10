import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateActionGaps } from '../apps/web/src/action-gap-engine.js';

test('Action Gap Engine flags stalled hand-offs with a concrete next step', () => {
  const now = Date.parse('2026-10-12T10:00:00Z');
  const [result] = evaluateActionGaps([{ id: 'case-1', stage: 'response', status: 'in_progress', createdAt: '2026-10-01T00:00:00Z', handoffAt: '2026-10-08T00:00:00Z', handoffSlaDays: 2 }], now);
  assert.ok(result.gapReasons.some((r) => r.code === 'HANDOFF_STALLED'));
  assert.match(result.nextStep, /receiving organization|receiving role/i);
});

test('Action Gap Engine treats cross-facility recurrence as a review prompt, not a diagnosis', () => {
  const [result] = evaluateActionGaps([{ id: 'case-2', stage: 'investigation', status: 'open', createdAt: '2026-10-11T00:00:00Z', matchingFacilityCount: 3 }], Date.parse('2026-10-12T10:00:00Z'));
  assert.ok(result.gapReasons.some((r) => r.code === 'CROSS_FACILITY_PATTERN'));
  assert.match(result.gapReasons.find((r) => r.code === 'CROSS_FACILITY_PATTERN').detail, /reviewer should verify/i);
});

test('Action Gap Engine flags recently reopened concerns and missing resource decisions', () => {
  const [reopened, blocked] = evaluateActionGaps([
    { id: 'case-3', stage: 'investigation', status: 'open', createdAt: '2026-10-11T00:00:00Z', resolvedAt: '2026-10-01T00:00:00Z', reappearedAt: '2026-10-10T00:00:00Z' },
    { id: 'case-4', stage: 'response', status: 'blocked', createdAt: '2026-10-11T00:00:00Z', blockerType: 'supplies', blocker: 'Awaiting supplies' }
  ], Date.parse('2026-10-12T10:00:00Z'));
  assert.ok(reopened.gapReasons.some((r) => r.code === 'RECENTLY_REOPENED'));
  assert.ok(blocked.gapReasons.some((r) => r.code === 'RESOURCE_DECISION_MISSING'));
});
