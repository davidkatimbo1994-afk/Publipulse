import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const runtime = String.raw`
import assert from 'node:assert/strict';
import { encodeAuditCursor, decodeAuditCursor } from './apps/api/src/audit-store.ts';
const event = { id: '42', occurredAt: '2026-10-11T12:34:56.000Z' };
const encoded = encodeAuditCursor(event);
assert.deepEqual(decodeAuditCursor(encoded), event);
assert.equal(decodeAuditCursor(undefined), undefined);
for (const bad of [null, '', 'not-base64!', 'e30', Buffer.from(JSON.stringify({ id: '0', occurredAt: event.occurredAt })).toString('base64url'), Buffer.from(JSON.stringify({ id: '9223372036854775808', occurredAt: event.occurredAt })).toString('base64url'), Buffer.from(JSON.stringify({ id: '1', occurredAt: '2026-02-30T12:00:00.000Z' })).toString('base64url'), Buffer.from(JSON.stringify({ id: '1', occurredAt: event.occurredAt, organizationId: 'other-tenant' })).toString('base64url')]) {
  assert.equal(decodeAuditCursor(bad), null, String(bad));
}
assert.equal(decodeAuditCursor('x'.repeat(513)), null);
`;

test('audit cursor codec accepts valid cursors and rejects malformed or out-of-range payloads at runtime', () => {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', runtime], {
    cwd: process.cwd(), encoding: 'utf8'
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
