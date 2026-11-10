import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { comparePackageVersions, evaluateReleaseReadiness, findMissingCiGates } from './check-release-readiness.mjs';

const rootDir = fileURLToPath(new URL('../', import.meta.url));

test('workspace release versions must match the root release version', () => {
  const root = { version: '1.2.3', workspaces: ['apps/api', 'apps/web'] };
  const workspaces = new Map([
    ['apps/api', { version: '1.2.3' }],
    ['apps/web', { version: '1.2.2' }],
  ]);
  assert.deepEqual(comparePackageVersions(root, workspaces), [
    'apps/web version 1.2.2 does not match root version 1.2.3',
  ]);
});

test('CI release preflight detects missing build, audit, and PostgreSQL integration gates', () => {
  const missing = findMissingCiGates('npm ci\nnpm test\n');
  assert.deepEqual(missing, [
    'npm run typecheck',
    'npm run build',
    'npm audit --omit=dev',
    'node scripts/check-workflow-action-pins.mjs',
    'apps/api/test/sql/rls.integration.sql',
    'apps/api/test/sql/verify_audit_integrity_posture.sql',
    'apps/api/test/sql/verify_outcome_integrity.sql',
    'apps/api/test/sql/verify_action_gap_reconciliation_integrity.sql',
  ]);
});

test('current package manifests and migration integrity are evaluated without hiding the lockfile blocker', async () => {
  const result = await evaluateReleaseReadiness(rootDir);
  assert.equal(result.version, '1.19.1');
  assert.equal(result.migrationCount, 42);
  assert.equal(result.checksumCount, 42);
  const lockfileExists = await access(new URL('../package-lock.json', import.meta.url)).then(() => true, () => false);
  assert.equal(result.blockers.some((item) => item.includes('package-lock.json is missing')), !lockfileExists);
  assert.deepEqual(result.blockers.filter((item) => item.includes('version') && item.includes('does not match')), []);
  assert.ok(result.warnings.some((item) => item.includes('does not prove live PostgreSQL/RLS')));
  const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.deepEqual(findMissingCiGates(ci), []);
  assert.match(ci, /npm run check:release-readiness/);
  const bootstrap = await readFile(new URL('../.github/workflows/lockfile-bootstrap.yml', import.meta.url), 'utf8');
  assert.match(bootstrap, /npm run check:release-readiness/);
});
