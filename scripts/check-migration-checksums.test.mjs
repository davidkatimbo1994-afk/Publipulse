import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMigrationChecksums } from './check-migration-checksums.mjs';

const digest = (text) => createHash('sha256').update(text).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'publipulse-migration-checks-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const migrationDir = join(root, 'migrations');
  await mkdir(migrationDir);
  const first = 'BEGIN; SELECT 1; COMMIT;\n';
  const second = 'BEGIN; SELECT 2; COMMIT;\n';
  await writeFile(join(migrationDir, '001_first.sql'), first);
  await writeFile(join(migrationDir, '002_second.sql'), second);
  const checksumFile = join(migrationDir, 'SHA256SUMS');
  await writeFile(checksumFile, `${digest(first)}  001_first.sql\n${digest(second)}  002_second.sql\n`);
  return { migrationDir, checksumFile };
}

test('migration checksum verifier accepts a complete matching manifest', async (t) => {
  const paths = await fixture(t);
  const result = await verifyMigrationChecksums(paths);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.checked, ['001_first.sql', '002_second.sql']);
});

test('migration checksum verifier detects changed historical SQL', async (t) => {
  const paths = await fixture(t);
  await writeFile(join(paths.migrationDir, '001_first.sql'), 'BEGIN; SELECT 999; COMMIT;\n');
  const result = await verifyMigrationChecksums(paths);
  assert.ok(result.failures.some((failure) => failure.includes('checksum mismatch: 001_first.sql')));
  assert.ok(result.failures.some((failure) => failure.includes('add a new migration instead')));
});

test('migration checksum verifier detects unmanifested and missing migrations', async (t) => {
  const paths = await fixture(t);
  await writeFile(join(paths.migrationDir, '003_untracked.sql'), 'BEGIN; SELECT 3; COMMIT;\n');
  await rm(join(paths.migrationDir, '002_second.sql'));
  const result = await verifyMigrationChecksums(paths);
  assert.ok(result.failures.some((failure) => failure.includes('manifest references missing migration: 002_second.sql')));
  assert.ok(result.failures.some((failure) => failure.includes('missing from checksum manifest: 003_untracked.sql')));
});

test('migration checksum verifier rejects malformed and duplicate manifest entries', async (t) => {
  const paths = await fixture(t);
  const original = await readFile(paths.checksumFile, 'utf8');
  const firstLine = original.split('\n')[0];
  await writeFile(paths.checksumFile, `not-a-checksum\n${firstLine}\n${firstLine}\n`);
  const result = await verifyMigrationChecksums(paths);
  assert.ok(result.failures.some((failure) => failure.includes('expected SHA-256')));
  assert.ok(result.failures.some((failure) => failure.includes('duplicate checksum entry')));
});
