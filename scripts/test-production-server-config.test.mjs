import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require('typescript');
} catch {
  ts = (() => { throw new Error('The typescript package is not installed. Run `npm ci` at the repository root, then re-run the tests.'); })();
}
const source = await readFile(new URL('../apps/api/src/server-config.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { parseApiPort, parseWebOrigins, validateProductionWebOrigin, validateProductionServiceConfig } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const valid = {
  databaseUrl: 'postgresql://app:secret@db.example.org:5432/publipulse',
  issuer: 'https://identity.example.org/',
  audience: 'publipulse-api',
  jwksUrl: 'https://identity.example.org/.well-known/jwks.json',
  webOrigin: 'https://app.example.org'
};

test('production startup requires an explicit web origin', () => {
  assert.throws(() => validateProductionWebOrigin('production', undefined), /WEB_ORIGIN must be explicitly configured/);
  assert.throws(() => validateProductionWebOrigin('production', '   '), /WEB_ORIGIN must be explicitly configured/);
});

test('production startup rejects malformed and non-HTTPS origins', () => {
  assert.throws(() => validateProductionWebOrigin('production', 'not a URL'), /valid origin URL/);
  assert.throws(() => validateProductionWebOrigin('production', 'http://example.org'), /production origins must use HTTPS/);
});

test('production startup rejects paths, credentials, queries and fragments in web origins', () => {
  for (const origin of [
    'https://example.org/app',
    'https://user:secret@example.org',
    'https://example.org?next=/app',
    'https://example.org#section',
    'https://example.org/'
  ]) assert.throws(() => validateProductionWebOrigin('production', origin), /origin without a path/);
  assert.doesNotThrow(() => validateProductionWebOrigin('production', 'https://example.org'));
});

test('production config rejects missing or whitespace-only required values', () => {
  for (const key of ['databaseUrl', 'issuer', 'audience', 'jwksUrl', 'webOrigin']) {
    const config = { ...valid, [key]: '   ' };
    assert.throws(() => validateProductionServiceConfig('production', config));
  }
});

test('production config accepts valid PostgreSQL and HTTPS OIDC URLs', () => {
  assert.doesNotThrow(() => validateProductionServiceConfig('production', valid));
});

test('production config rejects non-PostgreSQL database schemes', () => {
  assert.throws(() => validateProductionServiceConfig('production', { ...valid, databaseUrl: 'https://db.example.org' }), /DATABASE_URL must use/);
});

test('production config rejects insecure or credential-bearing OIDC URLs', () => {
  assert.throws(() => validateProductionServiceConfig('production', { ...valid, issuer: 'http://identity.example.org' }), /OIDC_ISSUER must be an HTTPS URL/);
  assert.throws(() => validateProductionServiceConfig('production', { ...valid, jwksUrl: 'https://user:secret@identity.example.org/jwks' }), /OIDC_JWKS_URL must be an HTTPS URL/);
});

test('non-production startup does not require production connection settings', () => {
  assert.doesNotThrow(() => validateProductionServiceConfig('test', {}));
  assert.doesNotThrow(() => validateProductionServiceConfig(undefined, {}));
});

test('server validates production configuration before allocating the PostgreSQL pool', async () => {
  const server = await readFile(new URL('../apps/api/src/server.ts', import.meta.url), 'utf8');
  assert.ok(server.indexOf('validateProductionServiceConfig(process.env.NODE_ENV') < server.indexOf('new PostgresPoolAdapter('));
});


test('production database URL requires an explicit host and database name', () => {
  for (const databaseUrl of [
    'postgresql:///publipulse',
    'postgresql://db.example.org',
    'postgresql://db.example.org/',
  ]) {
    assert.throws(
      () => validateProductionServiceConfig('production', { ...valid, databaseUrl }),
      /database host and explicit database name/,
    );
  }
  assert.doesNotThrow(() => validateProductionServiceConfig('production', valid));
});

test('production database URL rejects fragments and OIDC issuer query strings or fragments', () => {
  assert.throws(
    () => validateProductionServiceConfig('production', { ...valid, databaseUrl: `${valid.databaseUrl}#unexpected` }),
    /DATABASE_URL must not contain a fragment/,
  );
  for (const issuer of ['https://identity.example.org/?tenant=other', 'https://identity.example.org/#issuer']) {
    assert.throws(
      () => validateProductionServiceConfig('production', { ...valid, issuer }),
      /OIDC_ISSUER must not contain a query string or fragment/,
    );
  }
});


test('API_PORT defaults safely and accepts decimal TCP ports', () => {
  assert.equal(parseApiPort(undefined), 4000);
  assert.equal(parseApiPort('4001'), 4001);
  assert.equal(parseApiPort('65535'), 65535);
  assert.equal(parseApiPort('080'), 80);
});

test('API_PORT rejects empty, whitespace, non-decimal and out-of-range values', () => {
  for (const value of ['', ' ', ' 4000', '4000 ', '0', '-1', '65536', '4.5', '1e3', '0x50', '123456']) {
    assert.throws(() => parseApiPort(value), /valid decimal TCP port/, `expected rejection for ${JSON.stringify(value)}`);
  }
});

test('server uses strict API_PORT parsing before starting the listener', async () => {
  const server = await readFile(new URL('../apps/api/src/server.ts', import.meta.url), 'utf8');
  assert.match(server, /parseApiPort\(process\.env\.API_PORT\)/);
  assert.match(server, /app\.listen\(\{ port, host: '0\.0\.0\.0' \}\)/);
});


test('production database URL cannot override the application TLS policy', () => {
  for (const parameter of ['sslmode=disable', 'sslmode=require', 'sslcert=%2Ftmp%2Fclient.crt', 'sslkey=%2Ftmp%2Fclient.key', 'sslrootcert=%2Ftmp%2Fca.crt', 'ssl=0', 'options=-c%20search_path%3Dpublic']) {
    assert.throws(
      () => validateProductionServiceConfig('production', { ...valid, databaseUrl: `${valid.databaseUrl}?${parameter}` }),
      /must not override production TLS\/session policy/,
      `expected rejection for ${parameter}`,
    );
  }
  assert.doesNotThrow(() => validateProductionServiceConfig('production', valid));
});


test('production database URL rejects case variants and encoded TLS override parameter names', () => {
  for (const suffix of [
    '?SSLMODE=disable',
    '?SslRootCert=%2Ftmp%2Fca.crt',
    '?%73slmode=disable',
    '?application_name=service&SSLKEY=%2Ftmp%2Fclient.key',
    '?OPTIONS=-c%20search_path%3Dpublic',
    '?ssl=0',
  ]) {
    assert.throws(
      () => validateProductionServiceConfig('production', { ...valid, databaseUrl: `${valid.databaseUrl}${suffix}` }),
      /must not override production TLS\/session policy/,
      `expected rejection for ${suffix}`,
    );
  }
});

test('WEB_ORIGIN accepts one origin or a short comma-separated list of exact origins', () => {
  assert.deepEqual(parseWebOrigins('https://app.example.org', true), ['https://app.example.org']);
  assert.deepEqual(
    parseWebOrigins('https://app.example.org, https://field.example.org,https://app.example.org', true),
    ['https://app.example.org', 'https://field.example.org']
  );
  assert.deepEqual(parseWebOrigins('http://localhost:5173,http://localhost:5174', false), ['http://localhost:5173', 'http://localhost:5174']);
  assert.doesNotThrow(() => validateProductionWebOrigin('production', 'https://app.example.org,https://field.example.org'));
});

test('WEB_ORIGIN rejects wildcards, paths, empty entries, plain http in production and oversized lists', () => {
  for (const bad of ['*', 'https://app.example.org/', 'https://app.example.org/path', 'https://user@app.example.org', 'https://a.example.org,', ',https://a.example.org', 'not a url']) {
    assert.throws(() => parseWebOrigins(bad, true), /WEB_ORIGIN/, bad);
  }
  assert.throws(() => parseWebOrigins('https://app.example.org,http://field.example.org', true), /production origins must use HTTPS/);
  assert.throws(() => parseWebOrigins(Array.from({ length: 6 }, (_, i) => `https://h${i}.example.org`).join(','), true), /at most 5/);
  assert.throws(() => validateProductionWebOrigin('production', 'https://app.example.org,*'), /WEB_ORIGIN/);
});
