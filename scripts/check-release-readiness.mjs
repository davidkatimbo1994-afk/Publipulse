#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMigrationDirectory } from './check-migration-chain.mjs';
import { verifyMigrationChecksums } from './check-migration-checksums.mjs';
import { validateLockfile } from './verify-lockfile.mjs';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const workspacePaths = ['apps/api', 'apps/web', 'apps/field', 'packages/shared'];
const requiredCiMarkers = [
  'npm ci',
  'npm run typecheck',
  'npm test',
  'npm run build',
  'npm audit --omit=dev',
  'node scripts/check-workflow-action-pins.mjs',
  'apps/api/test/sql/rls.integration.sql',
  'apps/api/test/sql/verify_audit_integrity_posture.sql',
  'apps/api/test/sql/verify_outcome_integrity.sql',
  'apps/api/test/sql/verify_action_gap_reconciliation_integrity.sql',
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

export function comparePackageVersions(rootManifest, workspaceManifests) {
  const failures = [];
  for (const workspacePath of rootManifest.workspaces ?? []) {
    const manifest = workspaceManifests.get(workspacePath);
    if (!manifest) {
      failures.push(`missing workspace manifest: ${workspacePath}/package.json`);
      continue;
    }
    if (manifest.version !== rootManifest.version) {
      failures.push(`${workspacePath} version ${manifest.version} does not match root version ${rootManifest.version}`);
    }
  }
  return failures;
}

export function findMissingCiGates(ciWorkflow) {
  return requiredCiMarkers.filter((marker) => !ciWorkflow.includes(marker));
}

export async function evaluateReleaseReadiness(rootDir = defaultRoot) {
  const blockers = [];
  const warnings = [];
  let rootManifest;
  try {
    rootManifest = await readJson(join(rootDir, 'package.json'));
  } catch (error) {
    return { version: 'unknown', blockers: [`cannot read root package.json: ${error instanceof Error ? error.message : 'unknown error'}`], warnings };
  }

  const workspaceManifests = new Map();
  for (const workspacePath of rootManifest.workspaces ?? []) {
    try {
      workspaceManifests.set(workspacePath, await readJson(join(rootDir, workspacePath, 'package.json')));
    } catch (error) {
      blockers.push(`cannot read ${workspacePath}/package.json: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  blockers.push(...comparePackageVersions(rootManifest, workspaceManifests));

  const migrationDir = join(rootDir, 'apps/api/migrations');
  const migrationResult = await validateMigrationDirectory(migrationDir);
  blockers.push(...migrationResult.failures.map((failure) => `migration chain: ${failure}`));
  const checksumResult = await verifyMigrationChecksums({
    migrationDir,
    checksumFile: join(migrationDir, 'SHA256SUMS'),
  });
  blockers.push(...checksumResult.failures.map((failure) => `migration checksums: ${failure}`));

  const lockfilePath = join(rootDir, 'package-lock.json');
  if (!(await exists(lockfilePath))) {
    blockers.push('package-lock.json is missing; run the GitHub Actions lockfile bootstrap workflow, review its artifact, and commit the verified lockfile');
  } else {
    try {
      const lockfile = await readJson(lockfilePath);
      blockers.push(...validateLockfile({ rootManifest, workspaceManifests, lockfile }));
    } catch (error) {
      blockers.push(`package-lock.json is invalid: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  let ciWorkflow = '';
  try {
    ciWorkflow = await readFile(join(rootDir, '.github/workflows/ci.yml'), 'utf8');
  } catch (error) {
    blockers.push(`cannot read CI workflow: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  const missingCiGates = findMissingCiGates(ciWorkflow);
  if (missingCiGates.length) blockers.push(`CI workflow is missing required gates: ${missingCiGates.join(', ')}`);

  const actionPinWorkflow = join(rootDir, 'scripts/check-workflow-action-pins.mjs');
  if (!(await exists(actionPinWorkflow))) blockers.push('GitHub Actions immutable-reference verifier is missing');
  warnings.push('A passing static preflight does not prove live PostgreSQL/RLS, OIDC, deployment, privacy, or public-health governance readiness');

  return {
    version: rootManifest.version ?? 'unknown',
    migrationCount: migrationResult.entries.length,
    checksumCount: checksumResult.checked.length,
    blockers,
    warnings,
  };
}

async function main() {
  const result = await evaluateReleaseReadiness();
  console.log(`PubliPulse release readiness preflight — v${result.version}`);
  console.log(`Migration files checked: ${result.migrationCount}; checksums verified: ${result.checksumCount}`);
  if (result.blockers.length) {
    console.error(`BLOCKED (${result.blockers.length}):`);
    for (const blocker of result.blockers) console.error(`- ${blocker}`);
  } else {
    console.log('Static release preflight passed. External release gates still require evidence.');
  }
  if (result.warnings.length) {
    console.log('Warnings:');
    for (const warning of result.warnings) console.log(`- ${warning}`);
  }
  if (result.blockers.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`Release readiness preflight failed: ${error instanceof Error ? error.message : 'unexpected error'}`);
    process.exitCode = 1;
  });
}
