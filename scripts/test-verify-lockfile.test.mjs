import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLockfile } from './verify-lockfile.mjs';

function fixture() {
  const rootManifest = {
    name: 'publipulse', version: '0.54.0', workspaces: ['apps/api', 'apps/web', 'packages/shared'],
    devDependencies: { typescript: '^5.7.3' },
  };
  const workspaceManifests = new Map([
    ['apps/api', { name: '@publipulse/api', version: '0.54.0', dependencies: { fastify: '^5.2.1' } }],
    ['apps/web', { name: '@publipulse/web', version: '0.54.0', dependencies: { react: '^19.0.0' } }],
    ['packages/shared', { name: '@publipulse/shared', version: '0.54.0', dependencies: { zod: '^3.24.1' } }],
  ]);
  const lockfile = {
    lockfileVersion: 3,
    packages: {
      '': { name: 'publipulse', version: '0.54.0', devDependencies: { typescript: '^5.7.3' } },
      'apps/api': { name: '@publipulse/api', version: '0.54.0', dependencies: { fastify: '^5.2.1' } },
      'apps/web': { name: '@publipulse/web', version: '0.54.0', dependencies: { react: '^19.0.0' } },
      'packages/shared': { name: '@publipulse/shared', version: '0.54.0', dependencies: { zod: '^3.24.1' } },
    },
  };
  return { rootManifest, workspaceManifests, lockfile };
}

test('accepts a lockfile that matches every root and workspace manifest', () => {
  assert.deepEqual(validateLockfile(fixture()), []);
});

test('rejects unsupported lockfile versions and missing package maps', () => {
  const input = fixture();
  input.lockfile.lockfileVersion = 2;
  assert.match(validateLockfile(input)[0], /lockfileVersion 3/);
});

test('rejects root dependency drift', () => {
  const input = fixture();
  input.lockfile.packages[''].devDependencies.typescript = '^5.8.0';
  assert.ok(validateLockfile(input).some((message) => message === 'root devDependencies does not match package.json'));
});

test('rejects missing workspace lock entries', () => {
  const input = fixture();
  delete input.lockfile.packages['apps/web'];
  assert.ok(validateLockfile(input).some((message) => message.includes('missing workspace entry: apps/web')));
});

test('rejects workspace version and dependency drift', () => {
  const input = fixture();
  input.lockfile.packages['apps/api'].version = '0.53.0';
  input.lockfile.packages['apps/api'].dependencies.fastify = '^5.3.0';
  const errors = validateLockfile(input);
  assert.ok(errors.some((message) => message === 'apps/api version does not match its package.json'));
  assert.ok(errors.some((message) => message === 'apps/api dependencies does not match its package.json'));
});

test('rejects workspace list drift and missing manifests', () => {
  const input = fixture();
  input.rootManifest.workspaces = ['apps/api', 'apps/web', 'packages/shared', 'apps/worker'];
  const errors = validateLockfile(input);
  assert.ok(errors.some((message) => message.includes('workspace manifests do not match')));
  assert.ok(errors.some((message) => message.includes('missing workspace manifest: apps/worker')));
});
