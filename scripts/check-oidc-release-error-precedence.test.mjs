import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../apps/api/src/auth/oidc-actor-resolver.ts', import.meta.url), 'utf8');
const tests = await readFile(new URL('../apps/api/test/oidc-actor-resolver.test.ts', import.meta.url), 'utf8');

test('OIDC resolver tracks operation failure before connection cleanup', () => {
  assert.match(source, /let operationFailed = false/);
  assert.match(source, /catch \(error\) \{\s*operationFailed = true;[\s\S]*?ROLLBACK/);
  assert.match(source, /catch \(releaseError\) \{[\s\S]*?if \(!operationFailed\) throw releaseError/);
});

test('OIDC tests cover both primary-error precedence and standalone release failure', () => {
  assert.match(tests, /preserves the database error if connection release also fails/);
  assert.match(tests, /surfaces a release failure after an otherwise successful lookup/);
});
