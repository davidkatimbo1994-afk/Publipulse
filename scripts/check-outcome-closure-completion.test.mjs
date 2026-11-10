import { readWebSource } from './lib/web-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);

test('7-1-7 clocks are explicit and outcome completeness is a separate clock', async()=>{
  const shared=await readFile(new URL('packages/shared/src/outcome-clocks.ts',root),'utf8');
  assert.match(shared,/detectionToNotificationHours/); assert.match(shared,/detectionToResponseHours/); assert.match(shared,/detectionToMeasuredOutcomeHours/); assert.match(shared,/outcomeCompleteness/);
});

test('reporter feedback is append-only and privacy bounded', async()=>{
 const route=await readFile(new URL('apps/api/src/reporter-feedback-routes.ts',root),'utf8'); const migration=await readFile(new URL('apps/api/migrations/026_outcome_decay_resource_feedback.sql',root),'utf8');
 assert.match(route,/publicHealthNarrative/); assert.match(route,/deliveryStatus/); assert.match(migration,/reporter_feedback_no_update/); assert.match(migration,/reporter_feedback_events/);
});

test('community response completion can create a missing-feedback Action Gap', async()=>{
 const evaluator=await readFile(new URL('apps/api/src/action-gap/evaluator.ts',root),'utf8'); const workflow=await readFile(new URL('apps/api/src/action-gap/workflow-case-store.ts',root),'utf8');
 assert.match(evaluator,/NO_FEEDBACK_TO_SOURCE/); assert.match(workflow,/feedback_recorded/); assert.match(workflow,/reporter_feedback_events/);
});

test('offline action and outcome mutations use explicit client IDs and preserve conflicts', async()=>{
 const shared=await readFile(new URL('packages/shared/src/offline-workflow.ts',root),'utf8'); const web=readWebSource();
 assert.match(shared,/clientMutationId/); assert.match(shared,/action_update/); assert.match(shared,/outcome_assessment/); assert.match(shared,/status===409/);
 assert.match(web,/syncQueuedMutations/); assert.match(web,/action_update/); assert.match(web,/outcome_assessment/);
});
