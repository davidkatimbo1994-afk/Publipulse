import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const app = await fs.readFile(new URL('../apps/api/src/app.ts', import.meta.url), 'utf8');

test('production error logging does not serialize full error objects', () => {
  assert.match(app, /serializers:\s*\{\s*err:/s);
  assert.match(app, /errorName:\s*error instanceof Error \? error\.name/s);
  assert.doesNotMatch(app, /request\.log\.error\(\{\s*err:\s*error/s);
});

test('application error responses remain generic and correlated', () => {
  assert.match(app, /error: status === 500 \? 'internal_error' : 'request_error'/);
  assert.match(app, /requestId: request\.id/);
});
