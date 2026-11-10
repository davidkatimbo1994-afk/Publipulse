import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/lockfile-bootstrap.yml', import.meta.url), 'utf8');
const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

test('lockfile bootstrap is manually triggered and uses the supported Node 22 toolchain', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /node scripts\/check-workflow-action-pins\.mjs/);
  assert.match(workflow, /node-version:\s*22\.16\.0/);
  assert.match(workflow, /npm install --package-lock-only --ignore-scripts --no-audit --no-fund/);
  assert.match(workflow, /lockfileVersion !== 3/);
  assert.match(workflow, /node scripts\/verify-lockfile\.mjs/);
});

test('generated lockfile is retained as a short-lived artifact and validated with npm ci', () => {
  assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40} # v4\.6\.2/);
  assert.match(workflow, /sha256sum package-lock\.json > package-lock\.sha256/);
  assert.match(workflow, /sha256sum --check package-lock\.sha256/);
  assert.match(workflow, /timeout-minutes:\s*15/);
  assert.match(workflow, /timeout-minutes:\s*30/);
  assert.match(workflow, /name:\s*publipulse-package-lock/);
  assert.match(workflow, /package-lock\.sha256/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /retention-days:\s*7/);
  assert.match(workflow, /actions\/download-artifact@[0-9a-f]{40} # v4\.3\.0/);
  assert.match(workflow, /run:\s*npm ci/);
});

test('lockfile verification runs release checks and normal CI still blocks missing committed lockfiles', () => {
  for (const command of ['npm run check:migrations', 'node scripts/check-workflow-action-pins.mjs', 'npm run test:tools', 'npm run typecheck', 'npm test', 'npm run build', 'npm audit --omit=dev']) {
    assert.ok(workflow.includes(command), `missing release check: ${command}`);
  }
  assert.match(ci, /test -f package-lock\.json/);
  assert.match(ci, /npm ci/);
  assert.match(ci, /node scripts\/verify-lockfile\.mjs/);
});
