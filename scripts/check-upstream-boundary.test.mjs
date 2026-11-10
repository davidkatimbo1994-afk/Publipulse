import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
test('upstream event boundary is append-only and tenant isolated', async () => {
  const sql = await readFile(new URL('apps/api/migrations/033_upstream_event_receipts.sql', root), 'utf8');
  assert.match(sql, /UNIQUE \(organization_id, integration_profile_id, provider, external_event_id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON upstream_event_receipts/);
  assert.match(sql, /REVOKE UPDATE, DELETE ON upstream_event_receipts FROM PUBLIC/);
});
test('upstream route requires a verified DHIS2 integration profile', async () => {
  const source = await readFile(new URL('apps/api/src/upstream-event-routes.ts', root), 'utf8');
  assert.match(source, /provider==='dhis2'/);
  assert.match(source, /status==='verified'/);
  assert.match(source, /externalTransferPerformed:false/);
});
