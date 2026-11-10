import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');
const compiled = ts.transpileModule(await read('apps/field/src/mutation-builders.ts'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { buildActionUpdatePayload, buildOutcomePayload, ACTION_STATUSES, OUTCOME_RESULTS } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const A = '11111111-1111-4111-8111-111111111111';
const action = (o = {}) => ({ expectedVersion: '2', status: '', dueAt: '', completionEvidence: '', ...o });
const outcome = (o = {}) => ({
  actionId: A, indicatorName: 'Samples passing', result: 'improved', baselineValue: '40', targetValue: '80',
  followUpValue: '75', unit: '%', evidenceSummary: 'Retested 20 samples', evidenceReference: '', uncertaintyNote: '', ...o
});
const NOW = '2026-10-18T10:00:00.000Z';

test('enums mirror the shared schemas', async () => {
  const da = await read('packages/shared/src/decision-action.ts');
  const oa = await read('packages/shared/src/outcome-assessment.ts');
  const grab = (src, re) => [...src.match(re)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...ACTION_STATUSES], grab(da, /ResponseActionUpdateSchema[\s\S]*?status: z\.enum\(\[([^\]]+)\]/));
  assert.deepEqual([...OUTCOME_RESULTS], grab(oa, /result: z\.enum\(\[([^\]]+)\]/));
});

test('action update needs a version and at least one change', () => {
  assert.equal(buildActionUpdatePayload(action({ expectedVersion: '' })).ok, false);
  assert.equal(buildActionUpdatePayload(action({ expectedVersion: '0' })).ok, false);
  assert.equal(buildActionUpdatePayload(action({ expectedVersion: '1.5' })).ok, false);
  assert.equal(buildActionUpdatePayload(action()).ok, false);
  const r = buildActionUpdatePayload(action({ status: 'in_progress' }));
  assert.deepEqual(r.payload, { expectedVersion: 2, status: 'in_progress' });
});

test('completing an action requires evidence; payload has only schema keys', () => {
  assert.equal(buildActionUpdatePayload(action({ status: 'completed' })).ok, false);
  assert.equal(buildActionUpdatePayload(action({ status: 'completed', completionEvidence: 'ok' })).ok, false);
  const r = buildActionUpdatePayload(action({ status: 'completed', completionEvidence: 'Borehole chlorinated', dueAt: '2026-10-20T14:30' }));
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.payload).sort(), ['completionEvidence', 'dueAt', 'expectedVersion', 'status']);
  assert.match(r.payload.dueAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(buildActionUpdatePayload(action({ dueAt: 'not a date' })).ok, false);
});

test('outcome assessment follows the server rules', () => {
  const ok = buildOutcomePayload(outcome(), NOW);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.payload, {
    actionId: A, indicatorName: 'Samples passing', result: 'improved', evidenceSummary: 'Retested 20 samples',
    assessedAt: NOW, baselineValue: 40, targetValue: 80, followUpValue: 75, unit: '%'
  });
  assert.equal(buildOutcomePayload(outcome({ actionId: 'nope' }), NOW).ok, false);
  assert.equal(buildOutcomePayload(outcome({ indicatorName: 'x' }), NOW).ok, false);
  assert.equal(buildOutcomePayload(outcome({ baselineValue: 'abc' }), NOW).ok, false);
  assert.equal(buildOutcomePayload(outcome({ baselineValue: '', targetValue: '80' }), NOW).ok, false);
  assert.equal(buildOutcomePayload(outcome({ followUpValue: '' }), NOW).ok, false);
  assert.equal(buildOutcomePayload(outcome({ evidenceSummary: 'abcd' }), NOW).ok, false);
});

test('inconclusive outcomes need an uncertainty note but not a follow-up value', () => {
  const base = { result: 'inconclusive', baselineValue: '', targetValue: '', followUpValue: '' };
  assert.equal(buildOutcomePayload(outcome(base), NOW).ok, false);
  const r = buildOutcomePayload(outcome({ ...base, uncertaintyNote: 'Only 3 samples were collectable' }), NOW);
  assert.equal(r.ok, true);
  assert.equal('followUpValue' in r.payload, false);
});

test('the field UI queues both mutation kinds and no longer ships a replay-only queue', async () => {
  const ui = await read('apps/field/src/main.tsx');
  assert.match(ui, /kind: 'action_update'/);
  assert.match(ui, /kind: 'outcome_assessment'/);
  assert.match(ui, /buildActionUpdatePayload\(actionForm\)/);
  assert.match(ui, /buildOutcomePayload\(outcomeForm,/);
});
