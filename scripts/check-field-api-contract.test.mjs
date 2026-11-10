import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
const field = read('apps/field/src/main.tsx');
const queue = read('apps/field/src/offline-queue.ts');
const signalSchema = read('packages/shared/src/signal.ts');
const appTs = read('apps/api/src/app.ts');
const routes = read('apps/api/src/outcome-routes.ts');

const fieldValues = (name) => {
  const block = field.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))?.[1] ?? '';
  return [...block.matchAll(/value: '([a-z_]+)'/g)].map((m) => m[1]).sort();
};
const schemaEnum = (key) => {
  const m = signalSchema.match(new RegExp(`${key}: z\\.enum\\(\\[([^\\]]+)\\]`));
  return [...(m?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
};

test('field intake options match the shared SignalIntakeSchema enums exactly', () => {
  assert.deepEqual(fieldValues('CATEGORIES'), schemaEnum('category'));
  assert.deepEqual(fieldValues('SOURCES'), schemaEnum('sourceType'));
  assert.deepEqual(fieldValues('PRECISION'), schemaEnum('precision'));
});

test('field requests carry the organization header and use real API routes', () => {
  assert.match(field, /'x-organization-id': orgId/);
  assert.doesNotMatch(field, /\/v1\/outcomes/);
  assert.match(field, /\/v1\/signals\/\$\{encodeURIComponent\(item\.signalId!\)\}\/outcomes/);
  assert.match(routes, /\/v1\/signals\/:signalId\/outcomes/);
  assert.match(field, /'x-client-mutation-id': item\.clientMutationId/);
});

test('field never sends unknown keys to strict mutation schemas', () => {
  assert.match(field, /body: JSON\.stringify\(item\.payload\)/);
  assert.doesNotMatch(field, /\.\.\.item\.payload/);
});

test('client ids stay valid UUIDs even without crypto.randomUUID', () => {
  assert.match(queue, /getRandomValues/);
  assert.doesNotMatch(queue, /local-\$\{Date\.now\(\)\}/);
});

test('API CORS allows every custom header the browser clients send', () => {
  for (const h of ['content-type', 'authorization', 'idempotency-key', 'x-organization-id', 'x-client-mutation-id']) {
    assert.ok(appTs.includes(h), `CORS allow-list missing ${h}`);
  }
});
