import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const storeUrl = new URL('../apps/api/src/postgres-action-gap-store.ts', import.meta.url);
const source = await readFile(storeUrl, 'utf8');
const start = source.indexOf('async reconcileEvaluatedCase(');
const end = source.indexOf('\n async review(', start);
const reconcile = source.slice(start, end);
const reviewStart = source.indexOf('async review(');
const review = source.slice(reviewStart);

test('reconciliation serializes competing lifecycle changes by locking candidate rows', () => {
  assert.match(reconcile, /FOR UPDATE/);
  assert.match(reconcile, /WHERE organization_id=\$1 AND id=\$2 AND status='open' AND reviewed_by IS NULL AND reviewed_at IS NULL RETURNING id/);
});

test('review writes are conditional on the expected prior status', () => {
  assert.match(review, /WHERE organization_id=\$1 AND id=\$2 AND status=\$6 RETURNING/);
  assert.match(review, /'action_gap\.reviewed'/);
  assert.match(review, /ROLLBACK/);
});

test('automatic resolution and its audit event share one transaction', () => {
  assert.match(reconcile, /await c\.query\('BEGIN'\)/);
  const updateAt = reconcile.indexOf("UPDATE action_gap_detections SET status='resolved'");
  const auditAt = reconcile.indexOf("'action_gap.auto_resolved'");
  const commitAt = reconcile.indexOf("await c.query('COMMIT')");
  assert.ok(updateAt >= 0 && auditAt > updateAt && commitAt > auditAt);
  assert.match(reconcile, /catch\(e\)\{try\{await c\.query\('ROLLBACK'\)/);
});

test('concurrent repeat reconciliation cannot select already-resolved rows', () => {
  assert.match(reconcile, /status='open' AND reviewed_by IS NULL AND reviewed_at IS NULL/);
  assert.match(reconcile, /if\(!updated\.rows\[0\]\)continue/);
});

test('reviewer and automatic resolution remain conditional rather than unconditional overwrites', () => {
  assert.match(review, /SET status=\$3,reviewed_by=\$4,reviewed_at=now\(\)/);
  assert.match(reconcile, /SET status='resolved' WHERE organization_id=\$1 AND id=\$2 AND status='open' AND reviewed_by IS NULL AND reviewed_at IS NULL/);
});

test('multi-finding reconciliation acquires row locks in a stable order', () => {
  assert.match(reconcile, /fingerprint IS NOT NULL ORDER BY id FOR UPDATE SKIP LOCKED/);
  assert.match(reconcile, /SKIP LOCKED/);
});

test('reconciliation does not wait on rows currently locked by a reviewer transaction', () => {
  assert.match(reconcile, /ORDER BY id FOR UPDATE SKIP LOCKED/);
});

test('legacy signal-level findings without workflowCaseId remain eligible for scoped reconciliation', () => {
  assert.match(reconcile, /COALESCE\(supporting_evidence->>'workflowCaseId','signal'\)=\$3/);
});
