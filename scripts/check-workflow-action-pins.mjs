#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workflowDir = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
const immutableRef = /^[0-9a-f]{40}$/i;

export function findUnpinnedActions(workflowText) {
  const failures = [];
  const lines = workflowText.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*-\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/);
    if (!match) continue;
    const reference = match[1].split('@')[1];
    if (!match[1].includes('@') || !immutableRef.test(reference ?? '')) {
      failures.push(`line ${index + 1}: action reference must use a full 40-character commit SHA (${match[1]})`);
    }
  }
  return failures;
}

export async function verifyWorkflowActionPins(directory = workflowDir) {
  const failures = [];
  const files = (await readdir(directory)).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml')).sort();
  if (files.length === 0) failures.push('no GitHub Actions workflow files found');
  for (const file of files) {
    const contents = await readFile(join(directory, file), 'utf8');
    failures.push(...findUnpinnedActions(contents).map((failure) => `${file}: ${failure}`));
  }
  return { filesChecked: files.length, failures };
}

async function main() {
  const result = await verifyWorkflowActionPins();
  if (result.failures.length) {
    console.error(`GitHub Actions pin verification failed (${result.failures.length} issue(s)):`);
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`GitHub Actions pin verification passed (${result.filesChecked} workflow files).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`GitHub Actions pin verification failed: ${error instanceof Error ? error.message : 'unexpected error'}`);
    process.exitCode = 1;
  });
}
