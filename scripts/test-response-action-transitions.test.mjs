import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); }
catch { ts = (() => { throw new Error('The typescript package is not installed. Run `npm ci` at the repository root, then re-run the tests.'); })(); }
const source = await readFile(new URL('../apps/api/src/postgres-decision-action-store.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { isAllowedResponseActionTransition } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('response actions follow explicit forward workflow transitions', () => {
  for (const [from, to] of [['open', 'in_progress'], ['open', 'blocked'], ['open', 'cancelled'], ['in_progress', 'blocked'], ['in_progress', 'completed'], ['in_progress', 'cancelled'], ['blocked', 'in_progress'], ['blocked', 'cancelled']]) {
    assert.equal(isAllowedResponseActionTransition(from, to), true, `${from} -> ${to}`);
  }
});

test('response actions reject skipped, reversed, and terminal-state transitions', () => {
  for (const [from, to] of [['open', 'completed'], ['blocked', 'open'], ['cancelled', 'open'], ['completed', 'in_progress'], ['completed', 'cancelled'], ['cancelled', 'completed']]) {
    assert.equal(isAllowedResponseActionTransition(from, to), false, `${from} -> ${to}`);
  }
});

test('same-state edits remain possible for due dates and evidence metadata', () => {
  for (const status of ['open', 'in_progress', 'blocked']) assert.equal(isAllowedResponseActionTransition(status, status), true);
});

test('action update service checks transition policy before writing', () => {
  assert.match(source, /isAllowedResponseActionTransition\(old\.status,status\)/);
  assert.match(source, /if\(!isAllowedResponseActionTransition\(old\.status,status\)\)\{await c\.query\('ROLLBACK'\);return\{kind:'conflict'\}\}/);
});
