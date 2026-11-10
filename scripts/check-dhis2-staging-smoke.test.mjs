import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);

test('DHIS2 staging smoke test is explicitly constrained', async () => {
  const source = await readFile(new URL('scripts/dhis2-staging-metadata-smoke.mjs', root), 'utf8');
  assert.match(source, /DHIS2_BASE_URL/);
  assert.match(source, /DHIS2_BEARER_TOKEN/);
  assert.match(source, /DHIS2_ALLOWED_HOSTS/);
  assert.match(source, /protocol !== 'https:'/);
  assert.match(source, /redirect: 'error'/);
  assert.match(source, /AbortController/);
  assert.doesNotMatch(source, /console\.log\([^)]*token/i);
});

test('upstream intake uses the declared verified integration-profile state', async () => {
  const route = await readFile(new URL('apps/api/src/upstream-event-routes.ts', root), 'utf8');
  const store = await readFile(new URL('apps/api/src/upstream-ingestion-store.ts', root), 'utf8');
  assert.match(route, /provider==='dhis2'.*status==='verified'/s);
  assert.match(store, /status !== 'verified'/);
  assert.doesNotMatch(route, /status==='active'/);
  assert.doesNotMatch(store, /status !== 'active'/);
});
