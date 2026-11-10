import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const storeUrl = new URL('../apps/api/src/postgres-action-gap-store.ts', import.meta.url);
const source = await readFile(storeUrl, 'utf8');
const methodStart = source.indexOf('async reconcileEvaluatedCase(');
const methodEnd = source.indexOf('\n async review(', methodStart);
const method = source.slice(methodStart, methodEnd);

test('automatic reconciliation is organization and signal scoped', () => {
  assert.match(method, /set_config\('app\.organization_id',\$1,true\)/);
  assert.match(method, /WHERE organization_id=\$1 AND id=\$2 FOR KEY SHARE/);
  assert.match(method, /WHERE organization_id=\$1 AND signal_id=\$2/);
  assert.match(method, /COALESCE\(supporting_evidence->>'workflowCaseId','signal'\)=\$3/);
});

test('automatic resolution excludes reviewed rows and uses a conditional update', () => {
  assert.match(method, /status='open' AND reviewed_by IS NULL AND reviewed_at IS NULL/);
  assert.match(method, /UPDATE action_gap_detections SET status='resolved' WHERE organization_id=\$1 AND id=\$2 AND status='open' AND reviewed_by IS NULL AND reviewed_at IS NULL RETURNING id/);
});

test('resolution audit event is written only after the guarded update and before commit', () => {
  const updateAt = method.indexOf("UPDATE action_gap_detections SET status='resolved'");
  const auditAt = method.indexOf("'action_gap.auto_resolved'");
  const commitAt = method.indexOf("await c.query('COMMIT')");
  assert.ok(updateAt >= 0 && auditAt > updateAt && commitAt > auditAt, 'expected guarded update, audit insert, then commit');
  assert.match(method, /await c\.query\('ROLLBACK'\)/);
});

test('active fingerprints are preserved during stale-finding reconciliation', () => {
  assert.match(method, /const active=new Set\(activeFingerprints\)/);
  assert.match(method, /if\(active\.has\(row\.fingerprint\?\?''\)\)continue/);
});
