import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// apps/api and packages/shared run `vitest run`; a *.test.ts that imports node:test registers no vitest suite and fails the run.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === 'dist') return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

test('vitest-run workspaces contain no node:test based test files', () => {
  const offenders = ['apps/api', 'packages/shared']
    .flatMap((ws) => walk(path.join(root, ws)))
    .filter((file) => file.endsWith('.test.ts') && /from ['"]node:test['"]/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(root, file));
  assert.deepEqual(offenders, []);
});
