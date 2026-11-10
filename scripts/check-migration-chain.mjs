import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultMigrationDir = fileURLToPath(new URL('../apps/api/migrations/', import.meta.url));

/** Remove SQL comments and single-quoted string literals while preserving offsets and line breaks.
 * Double-quoted identifiers and dollar-quoted procedural bodies remain visible so destructive
 * statements in quoted identifiers or migration functions still receive review.
 */
export function maskSqlCommentsAndStrings(sql) {
  let output = '';
  let i = 0;
  let state = 'normal';
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (state === 'line-comment') {
      if (ch === '\n') { output += '\n'; state = 'normal'; }
      else output += ' ';
      i += 1;
      continue;
    }
    if (state === 'block-comment') {
      if (ch === '*' && next === '/') { output += '  '; i += 2; state = 'normal'; }
      else { output += ch === '\n' ? '\n' : ' '; i += 1; }
      continue;
    }
    if (state === 'single-quoted') {
      if (ch === "'" && next === "'") { output += '  '; i += 2; continue; }
      if (ch === "'") { output += ' '; state = 'normal'; i += 1; continue; }
      output += ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }
    if (ch === '-' && next === '-') { output += '  '; i += 2; state = 'line-comment'; continue; }
    if (ch === '/' && next === '*') { output += '  '; i += 2; state = 'block-comment'; continue; }
    if (ch === "'") { output += ' '; i += 1; state = 'single-quoted'; continue; }
    output += ch;
    i += 1;
  }
  return output;
}

/** Validate migration naming, sequence, transaction wrappers and destructive DDL. */
export async function validateMigrationDirectory(migrationDir = defaultMigrationDir) {
  const entries = (await readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'));
  const failures = [];

  if (entries.length === 0) {
    return { entries, failures: ['No SQL migrations found'] };
  }

  entries.forEach((name, index) => {
    const expectedPrefix = String(index + 1).padStart(3, '0');
    if (!name.startsWith(`${expectedPrefix}_`)) {
      failures.push(`${name}: expected migration prefix ${expectedPrefix}_`);
    }
    if (!/^[0-9]{3}_[a-z0-9_]+\.sql$/.test(name)) {
      failures.push(`${name}: filename must use NNN_lower_snake_case.sql`);
    }
  });

  for (const name of entries) {
    const sql = await readFile(join(migrationDir, name), 'utf8');
    const inspectedSql = maskSqlCommentsAndStrings(sql);
    const withoutLeadingComments = inspectedSql.trimStart();
    if (!/^BEGIN\s*;/i.test(withoutLeadingComments)) {
      failures.push(`${name}: migration must begin with an explicit BEGIN;`);
    }
    if (!/COMMIT\s*;\s*$/i.test(inspectedSql)) {
      failures.push(`${name}: migration must end with COMMIT;`);
    }
    if (/\bDROP\s+(?:TABLE|SCHEMA|DATABASE)\b/i.test(inspectedSql)) {
      failures.push(`${name}: destructive DROP requires explicit manual review and must not be silently added`);
    }
  }

  return { entries, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { entries, failures } = await validateMigrationDirectory();
  if (failures.length) {
    console.error('Migration-chain validation failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Migration-chain validation passed (${entries.length} sequential migrations):`);
    for (const name of entries) console.log(`- ${name}`);
  }
}
