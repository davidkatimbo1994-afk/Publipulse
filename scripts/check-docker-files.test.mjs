import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const dockerfile = read('Dockerfile');
const compose = read('docker-compose.yml');

test('Dockerfile defines the api, web and field targets that compose builds', () => {
  for (const t of ['api', 'web', 'field']) {
    assert.match(dockerfile, new RegExp(`^FROM .* AS ${t}$`, 'm'));
    assert.match(compose, new RegExp(`target: ${t}\\b`));
  }
});

test('every COPY --from references a stage that exists', () => {
  const stages = new Set([...dockerfile.matchAll(/^FROM .* AS (\S+)$/gm)].map((m) => m[1]));
  for (const m of dockerfile.matchAll(/--from=(\S+)/g)) assert.ok(stages.has(m[1]), `unknown stage ${m[1]}`);
});

test('the API image runs as a non-root user and starts the built server', () => {
  const api = dockerfile.slice(dockerfile.indexOf('AS api'), dockerfile.indexOf('# ---- static frontends'));
  assert.match(api, /^USER node$/m);
  assert.match(api, /apps\/api\/dist\/server\.js/);
  assert.match(api, /\/health\/live/);
});

test('compose passes the environment variables the API reads, and the database is not published', () => {
  const cfg = read('apps/api/src/server.ts');
  for (const v of ['DATABASE_URL', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URL', 'WEB_ORIGIN', 'API_PORT']) {
    assert.ok(cfg.includes(`process.env.${v}`), `${v} is read by server.ts`);
    assert.ok(compose.includes(`${v}:`), `${v} is set in compose`);
  }
  const db = compose.slice(compose.indexOf('  db:'), compose.indexOf('  migrate:'));
  assert.doesNotMatch(db, /^\s+ports:/m);
});

test('the migration runner covers the real migrations folder and never edits them', () => {
  assert.ok(readdirSync(new URL('../apps/api/migrations', import.meta.url)).some((f) => f.endsWith('.sql')));
  assert.match(compose, /\.\/apps\/api\/migrations:\/migrations:ro/);
  const sh = read('docker/db/migrate.sh');
  assert.match(sh, /modified after it was applied/);
  assert.doesNotMatch(sh, /-c "[^"]*:'/, 'psql -c does not interpolate variables');
});

test('the runtime role cannot own, bypass RLS, or rewrite the audit trail', () => {
  const sql = read('docker/db/roles.sql');
  assert.match(sql, /NOSUPERUSER/);
  assert.match(sql, /NOBYPASSRLS/);
  assert.match(sql, /REVOKE UPDATE, DELETE, TRUNCATE ON audit_events/);
});

test('nginx keeps security headers on every location that sets its own headers', () => {
  const conf = read('docker/nginx.conf');
  const locations = conf.match(/location [^{]*\{[^}]*add_header[^}]*\}/g) ?? [];
  assert.ok(locations.length >= 3);
  for (const l of locations) assert.match(l, /include \/etc\/nginx\/security-headers\.conf/);
  assert.ok(existsSync(new URL('../docker/nginx-security-headers.conf', import.meta.url)));
});

test('secrets are not baked into images or committed', () => {
  assert.match(read('.dockerignore'), /^\.env$/m);
  assert.doesNotMatch(dockerfile, /ENV [A-Z_]*(PASSWORD|SECRET|TOKEN)/);
});
