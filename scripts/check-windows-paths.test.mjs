import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// `new URL(..., import.meta.url).pathname` yields "/C:/..." on Windows, which becomes "C:\C:\..." once joined.
// Use fileURLToPath(...) or pass the URL object straight to fs instead.
test('scripts never derive file paths from URL.pathname', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const offenders = fs.readdirSync(dir)
    .filter((name) => name.endsWith('.mjs') && name !== 'check-windows-paths.test.mjs')
    .filter((name) => /import\.meta\.url\)\.pathname|root\.pathname/.test(fs.readFileSync(dir + name, 'utf8')));
  assert.deepEqual(offenders, []);
});
