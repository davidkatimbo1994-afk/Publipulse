import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSource as arity } from './check-sql-arity.mjs';
import { buildSchema, checkSource as columns } from './check-sql-columns.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const tables = buildSchema();

test('arity guard flags more columns than VALUES expressions', () => {
  const bad = "await c.query(`INSERT INTO outcomes (a,b,c) VALUES($1,$2) RETURNING a`,[1,2]);";
  assert.equal(arity('x.ts', bad).problems.length, 1);
});
test('arity guard flags parameter count mismatch', () => {
  const bad = "await c.query('INSERT INTO outcomes (a,b) VALUES($1,$2)',[1]);";
  assert.match(arity('x.ts', bad).problems[0], /passes 1 parameters/);
});
test('arity guard accepts a correct statement with nested calls in params', () => {
  const ok = "await c.query('INSERT INTO outcomes (a,b) VALUES($1,$2)',[f(1,2),[3,4]]);";
  assert.deepEqual(arity('x.ts', ok).problems, []);
});
test('column guard flags unknown columns and unknown tables', () => {
  assert.equal(columns('x.ts', "q('INSERT INTO outcomes (organization_id, not_a_column) VALUES($1,$2)')", tables).problems.length, 1);
  assert.equal(columns('x.ts', "q('INSERT INTO no_such_table (a) VALUES($1)')", tables).problems.length, 1);
});
test('schema map includes columns added by later migrations', () => {
  const cols = tables.get('outcomes');
  for (const c of ['indicator_code', 'target_value', 'assessment_result', 'client_mutation_id']) assert.ok(cols.has(c), c);
});
test('every INSERT/UPDATE in apps/api/src matches the arity and migrated schema', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(d, e.name)] : []);
  const problems = [];
  for (const f of walk(join(root, 'apps/api/src'))) {
    const text = readFileSync(f, 'utf8');
    problems.push(...arity(f, text).problems, ...columns(f, text, tables).problems);
  }
  assert.deepEqual(problems, []);
});
