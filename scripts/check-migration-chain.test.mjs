import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateMigrationDirectory } from './check-migration-chain.mjs';

async function withMigrations(files, run) {
  const dir = await mkdtemp(join(tmpdir(), 'publipulse-migrations-'));
  try {
    await mkdir(dir, { recursive: true });
    for (const [name, sql] of Object.entries(files)) await writeFile(join(dir, name), sql, 'utf8');
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const valid = '-- header comment\n/* migration metadata */\nBEGIN;\nSELECT 1;\nCOMMIT;\n';

test('accepts sequential migrations with explicit transactions and leading comments', async () => {
  await withMigrations({ '001_first_step.sql': valid, '002_second_step.sql': valid }, async (dir) => {
    const result = await validateMigrationDirectory(dir);
    assert.deepEqual(result.failures, []);
    assert.equal(result.entries.length, 2);
  });
});

test('rejects a missing migration number', async () => {
  await withMigrations({ '001_first_step.sql': valid, '003_third_step.sql': valid }, async (dir) => {
    const { failures } = await validateMigrationDirectory(dir);
    assert.ok(failures.some((failure) => failure.includes('expected migration prefix 002_')));
  });
});

test('rejects malformed names and missing transaction wrappers', async () => {
  await withMigrations({ '001_Bad-Name.sql': 'CREATE TABLE sample (id int);' }, async (dir) => {
    const { failures } = await validateMigrationDirectory(dir);
    assert.ok(failures.some((failure) => failure.includes('NNN_lower_snake_case.sql')));
    assert.ok(failures.some((failure) => failure.includes('explicit BEGIN')));
    assert.ok(failures.some((failure) => failure.includes('end with COMMIT')));
  });
});

test('flags destructive table, schema, or database drops for review', async () => {
  await withMigrations({ '001_drop_table.sql': 'BEGIN;\nDROP TABLE sample;\nCOMMIT;\n' }, async (dir) => {
    const { failures } = await validateMigrationDirectory(dir);
    assert.ok(failures.some((failure) => failure.includes('destructive DROP requires explicit manual review')));
  });
});

test('reports an empty migration directory', async () => {
  await withMigrations({}, async (dir) => {
    const { failures } = await validateMigrationDirectory(dir);
    assert.deepEqual(failures, ['No SQL migrations found']);
  });
});


test('does not mistake DROP text inside comments or string literals for destructive DDL', async () => {
  const sql = `BEGIN;
-- DROP TABLE old_table;
/* DROP SCHEMA legacy; */
SELECT 'DROP DATABASE example';
COMMIT;
`;
  await withMigrations({ '001_safe_text.sql': sql }, async (dir) => {
    const { failures } = await validateMigrationDirectory(dir);
    assert.deepEqual(failures, []);
  });
});

test('flags destructive DDL even when its target is a quoted identifier', async () => {
  await withMigrations({ '001_drop_quoted.sql': 'BEGIN;\nDROP TABLE "legacy_table";\nCOMMIT;\n' }, async (dir) => {
    const { failures } = await validateMigrationDirectory(dir);
    assert.ok(failures.some((failure) => failure.includes('destructive DROP requires explicit manual review')));
  });
});

test('rejects SQL after the final COMMIT', async () => {
  await withMigrations({ '001_after_commit.sql': 'BEGIN;\nSELECT 1;\nCOMMIT;\nSELECT 2;\n' }, async (dir) => {
    const { failures } = await validateMigrationDirectory(dir);
    assert.ok(failures.some((failure) => failure.includes('end with COMMIT')));
  });
});
