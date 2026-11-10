import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyMigrationChecksums } from './check-migration-checksums.mjs';

const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const bootstrap = await readFile(new URL('../.github/workflows/lockfile-bootstrap.yml', import.meta.url), 'utf8');

test('committed migration checksum manifest matches every SQL migration', async () => {
  const result = await verifyMigrationChecksums();
  assert.deepEqual(result.failures, []);
  assert.equal(result.checked.length, 42);
});

test('PostgreSQL CI verifies immutable migration checksums before applying SQL', () => {
  const check = ci.indexOf('node scripts/check-migration-checksums.mjs');
  const apply = ci.indexOf('Apply schema migration to disposable PostgreSQL');
  assert.ok(check >= 0, 'checksum verifier must be present');
  assert.ok(apply > check, 'checksum verification must precede database changes');
  assert.match(ci, /npm run check:migration-checksums/);
});

test('lockfile bootstrap release validation includes migration checksum verification', () => {
  assert.match(bootstrap, /npm run check:migration-checksums/);
});

test('PostgreSQL CI validates migration sequence and checksums before applying SQL', () => {
  const chain = ci.indexOf('node scripts/check-migration-chain.mjs');
  const checksums = ci.indexOf('node scripts/check-migration-checksums.mjs');
  const apply = ci.indexOf('Apply schema migration to disposable PostgreSQL');
  assert.ok(chain >= 0, 'migration-chain validator must run in PostgreSQL job');
  assert.ok(checksums > chain, 'checksum verification must follow chain validation');
  assert.ok(apply > checksums, 'both static checks must precede database changes');
});
