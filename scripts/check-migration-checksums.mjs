#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
const defaultMigrationDir = join(rootDir, 'apps/api/migrations');
const defaultChecksumFile = join(defaultMigrationDir, 'SHA256SUMS');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function parseManifest(text) {
  const entries = new Map();
  const errors = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([a-f0-9]{64})  ([0-9]{3}_[a-z0-9_]+\.sql)$/.exec(line);
    if (!match) {
      errors.push(`line ${index + 1}: expected SHA-256, two spaces, and migration filename`);
      continue;
    }
    const [, digest, filename] = match;
    if (entries.has(filename)) errors.push(`duplicate checksum entry: ${filename}`);
    entries.set(filename, digest);
  }
  return { entries, errors };
}

export async function verifyMigrationChecksums({ migrationDir = defaultMigrationDir, checksumFile = defaultChecksumFile } = {}) {
  const failures = [];
  let manifestText;
  try {
    manifestText = await readFile(checksumFile, 'utf8');
  } catch (error) {
    return { checked: [], failures: [`cannot read checksum manifest ${basename(checksumFile)}: ${error instanceof Error ? error.message : 'unknown error'}`] };
  }
  const { entries, errors } = parseManifest(manifestText);
  failures.push(...errors);

  let migrations;
  try {
    migrations = (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort();
  } catch (error) {
    return { checked: [], failures: [...failures, `cannot read migration directory: ${error instanceof Error ? error.message : 'unknown error'}`] };
  }

  const actualNames = new Set(migrations);
  for (const filename of entries.keys()) {
    if (!actualNames.has(filename)) failures.push(`manifest references missing migration: ${filename}`);
  }
  for (const filename of migrations) {
    const expected = entries.get(filename);
    if (!expected) {
      failures.push(`migration is missing from checksum manifest: ${filename}`);
      continue;
    }
    const actual = sha256(await readFile(join(migrationDir, filename)));
    if (actual !== expected) failures.push(`checksum mismatch: ${filename}; do not edit applied migrations, add a new migration instead`);
  }
  return { checked: migrations.filter((name) => entries.has(name)), failures };
}

async function main() {
  const { checked, failures } = await verifyMigrationChecksums();
  if (failures.length) {
    console.error('Migration checksum verification failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Migration checksums verified (${checked.length} SQL migrations).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`Migration checksum verification failed: ${error instanceof Error ? error.message : 'unexpected error'}`);
    process.exitCode = 1;
  });
}
