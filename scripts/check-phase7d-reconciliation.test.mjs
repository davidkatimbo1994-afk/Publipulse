import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const migration = join(fileURLToPath(root), 'apps/api/migrations/017_interoperability_provenance_reconciliation.sql');

test('phase 7D migration defines append-only provenance and reconciliation boundaries', async () => {
  const sql = await readFile(migration, 'utf8');
  assert.match(sql, /CREATE TABLE interoperability_provenance_events/i);
  assert.match(sql, /CREATE TABLE interoperability_reconciliation_snapshots/i);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /append-only/i);
  assert.match(sql, /transport_verified boolean NOT NULL DEFAULT false/i);
  assert.match(sql, /UNIQUE \(exchange_job_id\)/i);
});
