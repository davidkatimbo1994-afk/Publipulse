import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'apps/api/src/request-validation.ts'), 'utf8');

test('strict query-limit parser rejects coercion aliases and accepts bounded decimals', () => {
  assert.match(source, /typeof value !== 'string'/);
  assert.match(source, /Number\.isSafeInteger\(parsed\)/);
  assert.match(source, /parsed > max/);
});

test('API list routes use the shared strict query-limit parser', async () => {
  const files = ['signal-routes.ts','evidence-routes.ts','investigation-routes.ts','decision-action-routes.ts','action-handoff-routes.ts','action-gap-routes.ts','outcome-routes.ts'];
  for (const file of files) {
    const text = await readFile(path.join(root, 'apps/api/src', file), 'utf8');
    assert.match(text, /parseQueryLimit/, file);
    assert.doesNotMatch(text, /Number\([^)]*limit/, file);
  }
});
