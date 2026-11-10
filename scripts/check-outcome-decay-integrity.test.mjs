import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('outcome decay does not count recently measured outcomes as durable', async () => {
  const sql = await readFile(new URL('apps/api/src/postgres-learning-store.ts', root), 'utf8');
  assert.match(sql, /o\.measured_at \+ interval '30 days' <= \$3/);
  assert.match(sql, /pending_durability/);
});

test('learning routes use canonical decimal query parsing', async () => {
  const source = await readFile(new URL('apps/api/src/learning-routes.ts', root), 'utf8');
  assert.match(source, /parseStrictPositiveInt\(query\.days, 90, 3650\)/);
  assert.match(source, /parseStrictPositiveInt\(query\.minCell, 5, 1000\)/);
  assert.ok(source.includes("/^(?:0|[1-9]\\d*)$/"));
});
