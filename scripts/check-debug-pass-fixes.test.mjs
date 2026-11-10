import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { flushQueue, tomorrowIso } = await import('../apps/web/src/data/derive.ts');
const { axisTicks, slaRows } = await import('../apps/web/src/data/chartData.ts');
const { newClientId } = await import('../apps/web/src/lib/client-id.ts');
const { isHttpBaseUrl, isConfigReady } = await import('../apps/web/src/lib/api-config.ts');
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('flushQueue keeps failures queued and still sends the rest, in order', async () => {
  const r = await flushQueue(['a', 'b', 'c'], async (x) => { if (x === 'b') throw new Error('x'); });
  assert.deepEqual(r.sent, ['a', 'c']);
  assert.deepEqual(r.failed, ['b']);
});

test('tomorrowIso is relative to the supplied clock', () => {
  assert.equal(tomorrowIso(Date.UTC(2026, 10, 4, 12)), '2026-11-05');
  assert.equal(tomorrowIso(Date.UTC(2026, 11, 31, 23)), '2027-01-01');
});

test('axisTicks are whole numbers that end exactly on the axis maximum', () => {
  for (const top of [1, 2, 5, 10, 20, 50, 100]) {
    const t = axisTicks(top);
    assert.equal(t[0], 0);
    assert.equal(t.at(-1), top);
    assert.ok(t.every(Number.isInteger), `integer ticks for ${top}`);
    assert.equal(new Set(t).size, t.length);
  }
});

test('slaRows tolerates a zero time target', () => {
  const rows = slaRows([{ id: 'a', title: 'a', area: 'x', slaHours: 0, elapsedHours: 0, status: 'On Track' },
                        { id: 'b', title: 'b', area: 'x', slaHours: 4, elapsedHours: 9, status: 'Breached' }]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => Number.isFinite(r.elapsed / Math.max(r.target, 1))));
});

test('newClientId is a valid v4 UUID even without crypto.randomUUID', () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.match(newClientId(), re);
  const original = crypto.randomUUID;
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try { assert.match(newClientId(), re); } finally { Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true }); }
});

test('a half-typed API URL never counts as a connected session', () => {
  assert.equal(isHttpBaseUrl('h'), false);
  assert.equal(isHttpBaseUrl('https://'), false);
  assert.equal(isHttpBaseUrl('https://api.example.org'), true);
  const cfg = { baseUrl: 'api.example.org', organizationId: 'o', accessToken: 't', signalId: '', actionId: '' };
  assert.equal(isConfigReady(cfg), false);
  assert.equal(isConfigReady({ ...cfg, baseUrl: 'http://localhost:4000' }), true);
});

test('state updaters stay pure: no provider updates or queue flushes inside setState callbacks', () => {
  const ws = src('apps/web/src/areas/ConnectedWorkspace.tsx');
  assert.doesNotMatch(ws, /setCfg\(\(prev\) => \{[\s\S]{0,300}setSessionApiConfig/);
  const ctx = src('apps/web/src/context/AppContext.tsx');
  assert.doesNotMatch(ctx, /setIsOnline\(\(prev\) =>/);
  assert.doesNotMatch(ctx, /crypto\.randomUUID/);
});

test('field sync stops on auth or network failure instead of marking items rejected', () => {
  const m = src('apps/field/src/main.tsx');
  assert.match(m, /res\.status === 401 \|\| res\.status === 403/);
  assert.match(m, /stopped = 'network'/);
  assert.match(m, /Remove from device/);
  assert.match(src('apps/field/src/offline-queue.ts'), /tx\.onabort/);
});
