import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);

test('data lifecycle module defines hold precedence and review-only disposition', async () => {
  const source = await readFile(new URL('packages/shared/src/data-lifecycle.ts', root), 'utf8');
  assert.match(source, /legalHold/);
  assert.match(source, /eligible_for_review/);
  assert.doesNotMatch(source, /delete/i);
});

test('retention holds and disposition reviews are tenant isolated and append-only', async () => {
  const source = await readFile(new URL('apps/api/migrations/029_data_lifecycle_holds_and_disposition.sql', root), 'utf8');
  assert.match(source, /data_retention_holds/);
  assert.match(source, /data_disposition_reviews/);
  assert.match(source, /FORCE ROW LEVEL SECURITY/);
  assert.match(source, /data_disposition_reviews_no_update/);
  assert.match(source, /approved_for_disposition/);
});
