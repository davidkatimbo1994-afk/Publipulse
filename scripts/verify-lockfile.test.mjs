import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLockfile } from './verify-lockfile.mjs';

const root = { name: 'root', version: '1.0.0', workspaces: ['apps/a'], devDependencies: { left: '^1.0.0' } };
const ws = new Map([['apps/a', { name: '@x/a', version: '1.0.0' }]]);
const lock = (resolved, integrity = 'sha512-abc') => ({
  lockfileVersion: 3,
  packages: {
    '': { name: 'root', version: '1.0.0', workspaces: ['apps/a'], devDependencies: { left: '^1.0.0' } },
    'apps/a': { name: '@x/a', version: '1.0.0' },
    'node_modules/left': { version: '1.0.0', resolved, integrity }
  }
});

test('accepts lockfile entries resolved from the public npm registry', () => {
  assert.deepEqual(validateLockfile({ rootManifest: root, workspaceManifests: ws, lockfile: lock('https://registry.npmjs.org/left/-/left-1.0.0.tgz') }), []);
});

test('rejects entries resolved from a private mirror or plain http', () => {
  const errors = validateLockfile({ rootManifest: root, workspaceManifests: ws, lockfile: lock('http://35.245.43.102/npm/left/-/left-1.0.0.tgz') });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /outside https:\/\/registry\.npmjs\.org\//);
});

test('rejects registry entries that have no integrity hash', () => {
  const errors = validateLockfile({ rootManifest: root, workspaceManifests: ws, lockfile: lock('https://registry.npmjs.org/left/-/left-1.0.0.tgz', '') });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no integrity/);
});
