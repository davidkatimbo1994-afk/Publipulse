import { readWebSource } from './lib/web-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = readWebSource();

test('field IndexedDB queue uses one shared database version for all stores', () => {
  assert.match(source, /const fieldDbVersion = 2/);
  assert.doesNotMatch(source, /indexedDB\.open\(fieldDbName, 1\)/);
  assert.match(source, /ensureFieldStores\(request\.result\)/);
});

test('HTTP validation and authorization failures are not queued for offline retry', () => {
  assert.match(source, /if \(!response\.ok\) \{ setApiNotice\(text\(body\.error/);
  assert.match(source, /catch \(error\) \{ await writeFieldQueue\(item\)/);
});

test('network-failed outcome submissions can enter the offline mutation queue', () => {
  assert.match(source, /if \(!online \|\| \(error instanceof TypeError && \/fetch\|network\//);
});

test('web UI release version matches package release version', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../apps/web/package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, '1.19.1');
  assert.match(source, /<small>v1\.19\.1<\/small>/);
});
