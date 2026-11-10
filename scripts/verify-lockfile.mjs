#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspacePaths = ['apps/api', 'apps/web', 'apps/field', 'packages/shared'];
const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies'];

function sameJson(a, b) {
  return JSON.stringify(sortObject(a ?? {})) === JSON.stringify(sortObject(b ?? {}));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
  }
  return value;
}

export function validateLockfile({ rootManifest, workspaceManifests, lockfile }) {
  const errors = [];
  if (!lockfile || lockfile.lockfileVersion !== 3 || !lockfile.packages || typeof lockfile.packages !== 'object') {
    return ['package-lock.json must be npm lockfileVersion 3 with a packages object'];
  }

  const rootEntry = lockfile.packages[''];
  if (!rootEntry) errors.push('lockfile is missing the root package entry');
  else {
    for (const field of ['name', 'version']) {
      if ((rootManifest[field] ?? undefined) !== (rootEntry[field] ?? undefined)) {
        errors.push(`root ${field} does not match package.json`);
      }
    }
    for (const section of dependencySections) {
      if (!sameJson(rootManifest[section], rootEntry[section])) {
        errors.push(`root ${section} does not match package.json`);
      }
    }
  }

  const expectedWorkspaces = [...(rootManifest.workspaces ?? [])].sort();
  const actualWorkspaces = [...workspaceManifests.keys()].sort();
  if (!sameJson(expectedWorkspaces, actualWorkspaces)) {
    errors.push('workspace manifests do not match root package.json workspaces');
  }

  for (const workspacePath of expectedWorkspaces) {
    const manifest = workspaceManifests.get(workspacePath);
    if (!manifest) {
      errors.push(`missing workspace manifest: ${workspacePath}/package.json`);
      continue;
    }
    const entry = lockfile.packages[workspacePath];
    if (!entry) {
      errors.push(`lockfile is missing workspace entry: ${workspacePath}`);
      continue;
    }
    for (const field of ['name', 'version']) {
      if ((manifest[field] ?? undefined) !== (entry[field] ?? undefined)) {
        errors.push(`${workspacePath} ${field} does not match its package.json`);
      }
    }
    for (const section of dependencySections) {
      if (!sameJson(manifest[section], entry[section])) {
        errors.push(`${workspacePath} ${section} does not match its package.json`);
      }
    }
  }

  const registryPrefix = 'https://registry.npmjs.org/';
  const offRegistry = Object.entries(lockfile.packages).filter(([key, entry]) => key && !entry.link && typeof entry.resolved === 'string' && !entry.resolved.startsWith(registryPrefix));
  if (offRegistry.length) {
    const [firstKey, firstEntry] = offRegistry[0];
    errors.push(`${offRegistry.length} lockfile entries resolve outside ${registryPrefix} (first: ${firstKey} -> ${firstEntry.resolved}); regenerate the lockfile against the public npm registry`);
  }
  const missingIntegrity = Object.entries(lockfile.packages).filter(([key, entry]) => key && !entry.link && entry.resolved && !entry.integrity);
  if (missingIntegrity.length) errors.push(`${missingIntegrity.length} lockfile entries have no integrity hash (first: ${missingIntegrity[0][0]})`);

  return errors;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function main() {
  const rootManifest = await readJson(path.join(rootDir, 'package.json'));
  const lockfile = await readJson(path.join(rootDir, 'package-lock.json'));
  const workspaceManifests = new Map();
  for (const workspacePath of workspacePaths) {
    workspaceManifests.set(workspacePath, await readJson(path.join(rootDir, workspacePath, 'package.json')));
  }
  const errors = validateLockfile({ rootManifest, workspaceManifests, lockfile });
  if (errors.length) {
    for (const error of errors) console.error(`Lockfile verification failed: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('Lockfile matches root and all workspace manifests.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Lockfile verification failed: ${error instanceof Error ? error.message : 'unexpected error'}`);
    process.exitCode = 1;
  });
}
