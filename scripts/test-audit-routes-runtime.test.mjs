import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const require = createRequire(import.meta.url);
let ts;
try {
  ts = require('typescript');
} catch {
  ts = (() => { throw new Error('The typescript package is not installed. Run `npm ci` at the repository root, then re-run the tests.'); })();
}
const storeSource = await read('apps/api/src/audit-store.ts');
const routeSource = await read('apps/api/src/audit-routes.ts');
const validationSource = await read('apps/api/src/request-validation.ts');

function transpile(source) {
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
}
const storeJs = transpile(storeSource).replaceAll("from './signal-store.js'", "from './signal-store.js'");
const storeUrl = `data:text/javascript;base64,${Buffer.from(storeJs).toString('base64')}`;
const validationJs = transpile(validationSource);
const validationUrl = `data:text/javascript;base64,${Buffer.from(validationJs).toString('base64')}`;
const routeJs = transpile(routeSource).replace(
  "import { canReadAudit, decodeAuditCursor, encodeAuditCursor } from './audit-store.js';",
  `import { canReadAudit, decodeAuditCursor, encodeAuditCursor } from '${storeUrl}';`
).replace(
  "import { parseQueryLimit } from './request-validation.js';",
  `import { parseQueryLimit } from '${validationUrl}';`
);
const routeUrl = `data:text/javascript;base64,${Buffer.from(routeJs).toString('base64')}`;
const { registerAuditRoutes } = await import(routeUrl);

function setup({ actor = { organizationId: 'org-1', userId: 'user-1', roles: ['auditor'] }, rows = [], storeError } = {}) {
  let handler;
  const calls = [];
  const app = { get(path, fn) { assert.equal(path, '/v1/audit-events'); handler = fn; } };
  const store = { async list(...args) { calls.push(args); if (storeError) throw storeError; return rows; } };
  const resolveActor = async (...args) => { calls.push(['actor', ...args]); return actor; };
  const registered = registerAuditRoutes(app, { resolveActor, store });
  const invoke = async (query = {}, overrideActor = actor) => {
    await registered;
    const request = { headers: { authorization: 'Bearer test', 'x-organization-id': 'org-1' }, query, id: 'req-1' };
    if (overrideActor !== actor) request.headers.authorization = 'Bearer test';
    const reply = { statusCode: 200, body: undefined, code(code) { this.statusCode = code; return this; }, send(body) { this.body = body; return body; } };
    const body = await handler(request, reply);
    return { statusCode: reply.statusCode, body: reply.body ?? body, calls };
  };
  return { invoke, calls };
}

test('audit route enforces authentication and audit-reader roles before store access', async () => {
  const unauthenticated = setup({ actor: null });
  const unauth = await unauthenticated.invoke();
  assert.equal(unauth.statusCode, 401);
  assert.equal(unauth.body.error, 'authentication_required');
  assert.equal(unauthenticated.calls.some((c) => Array.isArray(c) && c[0] !== 'actor'), false);

  const forbidden = setup({ actor: { organizationId: 'org-1', userId: 'u2', roles: ['responder'] } });
  const denied = await forbidden.invoke();
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body.error, 'insufficient_permissions');
  assert.equal(forbidden.calls.some((c) => Array.isArray(c) && c[0] !== 'actor'), false);
});

test('audit route rejects ambiguous, non-canonical and out-of-range page sizes without querying store', async () => {
  for (const limit of [['25'], '01', '0', '1.5', '+1', '-1', '101', ' 1', '1 ', '', 25, null]) {
    const { invoke, calls } = setup();
    const result = await invoke({ limit });
    assert.equal(result.statusCode, 400, `limit=${JSON.stringify(limit)}`);
    assert.equal(result.body.error, 'invalid_limit', `limit=${JSON.stringify(limit)}`);
    assert.equal(calls.some((c) => Array.isArray(c) && c[0] !== 'actor'), false, `store must not be called for ${JSON.stringify(limit)}`);
  }
});

test('audit route defaults to 25, caps at 100, fetches one extra row and emits a continuation cursor', async () => {
  const rows = Array.from({ length: 3 }, (_, i) => ({ id: String(30 - i), actorUserId: null, action: 'signal.created', resourceType: 'signal', resourceId: null, outcome: 'success', occurredAt: `2026-10-11T12:0${i}:00.000Z` }));
  const { invoke, calls } = setup({ rows });
  const result = await invoke();
  assert.equal(result.statusCode, 200);
  assert.equal(calls.find((c) => Array.isArray(c) && c[0] !== 'actor')[1], 26);
  assert.equal(result.body.events.length, 3);
  assert.equal(result.body.nextCursor, null);

  const many = [...rows, { ...rows[0], id: '27' }];
  const paged = setup({ rows: many });
  const page = await paged.invoke({ limit: '3' });
  assert.equal(page.statusCode, 200);
  assert.equal(page.body.events.length, 3);
  assert.equal(typeof page.body.nextCursor, 'string');
  assert.equal(paged.calls.find((c) => Array.isArray(c) && c[0] !== 'actor')[1], 4);
  const bounded = setup({ rows: [] });
  await bounded.invoke({ limit: '100' });
  assert.equal(bounded.calls.find((c) => Array.isArray(c) && c[0] !== 'actor')[1], 101);
});

test('audit route rejects invalid cursors before store access and passes valid cursor through', async () => {
  const invalid = setup();
  const bad = await invalid.invoke({ cursor: 'not-base64!' });
  assert.equal(bad.statusCode, 400);
  assert.equal(bad.body.error, 'invalid_cursor');
  assert.equal(invalid.calls.some((c) => Array.isArray(c) && c[0] !== 'actor'), false);

  const encoded = Buffer.from(JSON.stringify({ id: '9', occurredAt: '2026-10-11T12:00:00.000Z' })).toString('base64url');
  const valid = setup();
  const result = await valid.invoke({ limit: '5', cursor: encoded });
  assert.equal(result.statusCode, 200);
  const listCall = valid.calls.find((c) => Array.isArray(c) && c[0] !== 'actor');
  assert.equal(listCall[1], 6);
  assert.deepEqual(listCall[2], { id: '9', occurredAt: '2026-10-11T12:00:00.000Z' });
});

test('audit route propagates storage failures for centralized API error handling', async () => {
  const primary = new Error('store unavailable');
  const { invoke } = setup({ storeError: primary });
  await assert.rejects(() => invoke(), (error) => error === primary);
});
