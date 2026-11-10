import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch { throw new Error('The typescript package is not installed. Run `npm ci` at the repository root, then re-run the tests.'); }
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'pp-community-'));

const compile = (srcPath, name) => {
  let js = ts.transpileModule(read(srcPath), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  js = js.replace(/from '\.\/([a-z0-9-]+)\.js'/g, "from './$1.mjs'").replace(/'@publipulse\/shared'/g, "'./shim.mjs'").replace(/'zod'/g, "'./zodstub.mjs'");
  writeFileSync(join(dir, `${name}.mjs`), js);
};
writeFileSync(join(dir, 'zodstub.mjs'), "export const z = { ZodIssueCode: { custom: 'custom' } };\n");
writeFileSync(join(dir, 'shim.mjs'), `export * from './community-flow.mjs';
export { findDirectIdentifierPattern } from './data-boundary.mjs';
export const DEFAULT_COMMUNITY_LIMITS = { senderPerHour: 3, senderPerDay: 10, organizationPerHour: 500, cooldownRejects: 3, cooldownHours: 24 };
export const CommunityReviewSchema = { safeParse: (b) => (b && typeof b === 'object' && ['promote','merge','dismiss'].includes(b.decision) ? { success: true, data: b } : { success: false, error: { issues: [{ path: ['decision'], code: 'invalid' }] } }) };
`);
const shared = 'packages/shared/src/'; const api = 'apps/api/src/';
compile(shared + 'community-flow.ts', 'community-flow');
compile(shared + 'data-boundary.ts', 'data-boundary');
for (const n of ['community-intake-config', 'community-intake-store', 'postgres-community-intake-store', 'community-intake-service', 'gateway-africastalking', 'community-intake-routes']) compile(api + `${n}.ts`, n);
const load = (n) => import(pathToFileURL(join(dir, `${n}.mjs`)).href);
const flow = await load('community-flow');
const cfgMod = await load('community-intake-config');
const { PostgresCommunityIntakeStore, defaultSummary } = await load('postgres-community-intake-store');
const { createCommunityIntakeService, LIMITED_REPLY, IDENTIFIER_REPLY } = await load('community-intake-service');
const gw = await load('gateway-africastalking');
const routes = await load('community-intake-routes');

const ORG = '11111111-1111-4111-8111-111111111111';
const ORG2 = '44444444-4444-4444-8444-444444444444';
const U1 = '22222222-2222-4222-8222-222222222222';
const SUB = '55555555-5555-4555-8555-555555555555';
const SIG = '66666666-6666-4666-8666-666666666666';
const NOW = new Date('2026-11-05T10:00:00Z');
const LIMITS = { senderPerHour: 3, senderPerDay: 10, organizationPerHour: 500, cooldownRejects: 3, cooldownHours: 24 };
const AREAS = [{ code: 'KE-A', label: 'Ward A' }, { code: 'KE-B', label: 'Ward B' }];
const FLOW = { areas: AREAS };
const reviewer = { userId: U1, organizationId: ORG, roles: ['reviewer'] };
const H1 = 'a'.repeat(64); const H2 = 'b'.repeat(64);

function fakePool(handler = () => undefined) {
  const log = [];
  return { log, async connect() { return { async query(sql, values = []) { log.push({ sql, values }); return handler(sql, values) ?? { rows: [] }; }, release() { log.push({ sql: 'RELEASE', values: [] }); } }; } };
}
const sqls = (p) => p.log.map((l) => l.sql.replace(/\s+/g, ' ').trim());
const inserts = (p, table) => p.log.filter((l) => l.sql.includes(`INSERT INTO ${table}`));

/* ------------------------------------------------------------------ flow */

test('USSD: consent first, then category, area, urgency; nothing is submitted before the last step', () => {
  assert.match(flow.handleUssd('', FLOW).reply, /We keep your report, not your number/);
  assert.equal(flow.handleUssd('', FLOW).end, false);
  for (const t of ['1', '1*3', '1*3*2']) assert.equal(flow.handleUssd(t, FLOW).kind, 'reply');
  const done = flow.handleUssd('1*3*2*1', FLOW);
  assert.equal(done.kind, 'submit');
  assert.deepEqual(done.submission, { channel: 'ussd', category: 'supply_gap', areaCode: 'KE-B', urgent: true, narrative: null, consentVersion: 'v1' });
});

test('USSD: declining or bad input stores nothing and ends the session', () => {
  for (const t of ['2', '9', '1*9', '1*3*7', '1*3*2*5', '1*3*2*1*1', 'abc', '1#', '1*1*1*1*1*1*1*1*1*1*1*1*1*1*1*1*1*1*1*1*1*1']) {
    const r = flow.handleUssd(t, FLOW);
    assert.equal(r.kind, 'reply', t); assert.equal(r.end, true, t);
  }
  assert.match(flow.handleUssd('2', FLOW).reply, /Nothing was saved/);
});

test('SMS: only a complete REPORT message is a report; anything else gets the consent text and keeps nothing', () => {
  const ok = flow.handleSms('report 2 1 urgent  three   sick children', FLOW);
  assert.equal(ok.kind, 'submit');
  assert.deepEqual(ok.submission, { channel: 'sms', category: 'water_sanitation', areaCode: 'KE-A', urgent: true, narrative: 'three sick children', consentVersion: 'v1' });
  for (const t of ['hello', 'REPORT', 'REPORT 9 1', 'REPORT 1 3', 'my neighbour is sick']) {
    const r = flow.handleSms(t, FLOW);
    assert.equal(r.kind, 'reply', t);
    assert.match(r.reply, /not your number/);
  }
  assert.match(flow.handleSms('STOP', FLOW).reply, /Nothing was saved/);
  assert.match(flow.handleSms('REPORT 1 1 ' + 'x'.repeat(161), FLOW).reply, /too long/);
});

test('flow configuration: area count, repeated codes and screens over the USSD limit are refused', () => {
  assert.deepEqual(flow.validateFlowConfig(FLOW), []);
  assert.ok(flow.validateFlowConfig({ areas: [] }).length > 0);
  assert.ok(flow.validateFlowConfig({ areas: [{ code: 'A', label: 'x' }, { code: 'A', label: 'y' }] }).some((p) => /repeated/.test(p)));
  assert.ok(flow.validateFlowConfig({ areas: Array.from({ length: 9 }, (_, i) => ({ code: 'A' + i, label: 'A very long ward name' })) }).some((p) => /area menu screen/.test(p)));
  assert.ok(flow.validateFlowConfig({ areas: [{ code: 'A', label: 'bad*label' }] }).length > 0);
});

/* ---------------------------------------------------------------- config */

const goodEnv = () => ({
  COMMUNITY_INTAKE_CHANNELS: JSON.stringify([{ organizationId: ORG, ussdServiceCode: '*384*12#', smsShortCode: '23456', areas: AREAS }]),
  COMMUNITY_INTAKE_PEPPER: 'p'.repeat(40), COMMUNITY_INTAKE_WEBHOOK_SECRET: 's'.repeat(30)
});
test('config: nothing set means off; a good setup is ready; partial or weak setups are reported, never run open', () => {
  assert.equal(cfgMod.loadCommunityIntakeConfig({}).status, 'not_configured');
  const ok = cfgMod.loadCommunityIntakeConfig(goodEnv());
  assert.equal(ok.status, 'ready');
  assert.equal(ok.config.limits.senderPerHour, 3);
  assert.equal(ok.config.gatewayRateLimitPerMinute, 1200);
  const weak = cfgMod.loadCommunityIntakeConfig({ ...goodEnv(), COMMUNITY_INTAKE_PEPPER: 'short' });
  assert.equal(weak.status, 'invalid'); assert.ok(weak.problems.some((p) => /PEPPER/.test(p)));
  assert.equal(cfgMod.loadCommunityIntakeConfig({ COMMUNITY_INTAKE_PEPPER: 'p'.repeat(40) }).status, 'invalid');
  const dup = cfgMod.loadCommunityIntakeConfig({ ...goodEnv(), COMMUNITY_INTAKE_CHANNELS: JSON.stringify([{ organizationId: ORG, ussdServiceCode: '*1#', areas: AREAS }, { organizationId: ORG2, ussdServiceCode: '*1#', areas: AREAS }]) });
  assert.ok(dup.problems.some((p) => /used twice/.test(p)));
  assert.equal(cfgMod.loadCommunityIntakeConfig({ ...goodEnv(), COMMUNITY_INTAKE_LIMITS: '{"senderPerHour":0}' }).status, 'invalid');
  assert.equal(cfgMod.loadCommunityIntakeConfig({ ...goodEnv(), COMMUNITY_INTAKE_CHANNELS: 'not json' }).status, 'invalid');
});

/* ------------------------------------------------------------------ store */

const accepted = (id = SUB) => (sql) => (sql.includes('INSERT INTO community_intake_submissions') ? { rows: [{ id }] } : undefined);
const SUBMISSION = { channel: 'ussd', category: 'supply_gap', areaCode: 'KE-A', urgent: false, narrative: null, consentVersion: 'v1' };

test('receive: stores the submission and the hashes separately, never the other way round', async () => {
  const pool = fakePool(accepted());
  const r = await new PostgresCommunityIntakeStore(pool).receive(ORG, { senderHash: H1, duplicateHash: H2, submission: SUBMISSION }, NOW, LIMITS);
  assert.deepEqual(r, { kind: 'accepted', id: SUB });
  const s = sqls(pool);
  assert.equal(s[0], 'BEGIN');
  assert.ok(s[1].includes("set_config('app.organization_id'"));
  assert.ok(s[2].includes('pg_advisory_xact_lock'), 'serialises per sender before reading counts');
  assert.ok(s.includes('COMMIT'));
  const sub = inserts(pool, 'community_intake_submissions')[0];
  assert.equal(JSON.stringify(sub.values).includes(H1) || JSON.stringify(sub.values).includes(H2), false, 'no hash on the submission');
  const ev = inserts(pool, 'community_sender_events')[0];
  assert.equal(JSON.stringify(ev.values).includes(SUB), false, 'nothing on the event row can point back to the submission');
  assert.ok(ev.values.includes(H1) && ev.values.includes(H2));
  assert.ok(inserts(pool, 'audit_events').some((a) => a.sql.includes("'community_intake.received'")));
});

test('receive: an identical report within 24 hours is a duplicate and stores nothing', async () => {
  const pool = fakePool((sql) => (sql.includes('duplicate_hash=$3') ? { rows: [{ id: '1' }] } : undefined));
  assert.deepEqual(await new PostgresCommunityIntakeStore(pool).receive(ORG, { senderHash: H1, duplicateHash: H2, submission: SUBMISSION }, NOW, LIMITS), { kind: 'duplicate' });
  assert.equal(inserts(pool, 'community_intake_submissions').length, 0);
});

test('receive: hourly and daily limits refuse, record one rejection, and store nothing', async () => {
  for (const [h, d, reason] of [[3, 3, 'sender_hourly'], [1, 10, 'sender_daily']]) {
    const pool = fakePool((sql) => (sql.includes('FILTER (WHERE occurred_at') ? { rows: [{ h, d }] } : undefined));
    assert.deepEqual(await new PostgresCommunityIntakeStore(pool).receive(ORG, { senderHash: H1, duplicateHash: H2, submission: SUBMISSION }, NOW, LIMITS), { kind: 'limited', reason });
    assert.equal(inserts(pool, 'community_intake_submissions').length, 0);
    assert.equal(inserts(pool, 'community_sender_events').length, 1);
    assert.match(inserts(pool, 'community_sender_events')[0].sql, /'rejected'/);
  }
});

test('cooldown: three rejections within an hour block for 24 hours; spread-out rejections do not', async () => {
  const at = (mins) => ({ occurred_at: new Date(NOW.getTime() - mins * 60000) });
  const run = async (rows) => {
    const pool = fakePool((sql) => (sql.includes("kind='rejected' AND occurred_at >") ? { rows } : accepted()(sql)));
    const r = await new PostgresCommunityIntakeStore(pool).receive(ORG, { senderHash: H1, duplicateHash: H2, submission: SUBMISSION }, NOW, LIMITS);
    return { r, pool };
  };
  const blocked = await run([at(5), at(20), at(50)]);
  assert.deepEqual(blocked.r, { kind: 'limited', reason: 'cooldown' });
  assert.equal(inserts(blocked.pool, 'community_sender_events').length, 0, 'a blocked sender is not extended further');
  assert.equal((await run([at(5), at(120), at(300)])).r.kind, 'accepted');
  assert.equal((await run([at(5), at(20)])).r.kind, 'accepted');
});

test('organisation cap: refuses, and audits only once per hour using a marker', async () => {
  const first = fakePool((sql) => (sql.includes("kind IN ('accepted','rejected')") ? { rows: [{ n: 500 }] } : undefined));
  assert.deepEqual(await new PostgresCommunityIntakeStore(first).receive(ORG, { senderHash: H1, duplicateHash: H2, submission: SUBMISSION }, NOW, LIMITS), { kind: 'limited', reason: 'organization_cap' });
  assert.ok(sqls(first).some((x) => x.includes("'community_intake.organization_cap_reached'")));
  const again = fakePool((sql) => (sql.includes("kind IN ('accepted','rejected')") ? { rows: [{ n: 600 }] } : sql.includes("kind='marker'") ? { rows: [{ id: '9' }] } : undefined));
  await new PostgresCommunityIntakeStore(again).receive(ORG, { senderHash: H1, duplicateHash: H2, submission: SUBMISSION }, NOW, LIMITS);
  assert.equal(sqls(again).some((x) => x.includes('audit_events')), false);
  assert.equal(inserts(again, 'community_sender_events').length, 0);
});

test('reject counts toward the cooldown unless the sender is already blocked', async () => {
  const pool = fakePool();
  await new PostgresCommunityIntakeStore(pool).reject(ORG, H1, NOW, LIMITS);
  assert.equal(inserts(pool, 'community_sender_events').length, 1);
  const at = (m) => ({ occurred_at: new Date(NOW.getTime() - m * 60000) });
  const blocked = fakePool((sql) => (sql.includes("kind='rejected' AND occurred_at >") ? { rows: [at(1), at(2), at(3)] } : undefined));
  await new PostgresCommunityIntakeStore(blocked).reject(ORG, H1, NOW, LIMITS);
  assert.equal(inserts(blocked, 'community_sender_events').length, 0);
});

const reviewHandler = (opts = {}) => (sql) => {
  if (sql.includes('FROM community_intake_submissions WHERE')) return opts.missing ? { rows: [] } : { rows: [{ channel: 'sms', category: 'water_sanitation', area_code: 'KE-A', narrative: 'dirty well', urgent: true, received_at: NOW }] };
  if (sql.includes('FROM community_intake_reviews WHERE')) return opts.reviewed ? { rows: [{ id: 'r' }] } : { rows: [] };
  if (sql.includes('INSERT INTO signals')) return { rows: [{ id: SIG }] };
  if (sql.includes('INSERT INTO community_intake_reviews') && opts.fkFail) throw Object.assign(new Error('fk'), { code: '23503' });
};

test('review: promoting creates the signal and the decision in one transaction, tied to the submission', async () => {
  const pool = fakePool(reviewHandler());
  const r = await new PostgresCommunityIntakeStore(pool).review(reviewer, SUB, { decision: 'promote' }, NOW);
  assert.deepEqual(r, { kind: 'reviewed', decision: 'promoted', signalId: SIG });
  const s = sqls(pool);
  assert.ok(s[2].includes('pg_advisory_xact_lock'));
  const sig = inserts(pool, 'signals')[0];
  assert.match(sig.sql, /'community_report'/);
  assert.equal(sig.values[2], SUB, 'client submission id is the submission id');
  assert.equal(sig.values[3], 'environmental_hazard', 'water/sanitation maps to environmental hazard');
  assert.equal(sig.values[7], 'community');
  assert.match(sig.values[4], /several people are sick/);
  assert.match(sig.values[4], /dirty well/);
  const rev = inserts(pool, 'community_intake_reviews')[0];
  assert.deepEqual([rev.values[2], rev.values[4], rev.values[5]], ['promoted', SIG, U1]);
  assert.ok(s.indexOf('COMMIT') > s.findIndex((x) => x.startsWith('INSERT INTO community_intake_reviews')));
  assert.ok(s.some((x) => x.includes("'signal.created'")) && s.some((x) => x.includes("'community_intake.reviewed'")));
});

test('review: a reviewer-written summary and category override the defaults', async () => {
  const pool = fakePool(reviewHandler());
  await new PostgresCommunityIntakeStore(pool).review(reviewer, SUB, { decision: 'promote', summary: 'Reviewer wrote this summary', category: 'unusual_illness', precision: 'district' }, NOW);
  const sig = inserts(pool, 'signals')[0];
  assert.deepEqual([sig.values[3], sig.values[4], sig.values[7]], ['unusual_illness', 'Reviewer wrote this summary', 'district']);
});

test('review: unknown, already decided, dismissed and merged cases', async () => {
  assert.deepEqual(await new PostgresCommunityIntakeStore(fakePool(reviewHandler({ missing: true }))).review(reviewer, SUB, { decision: 'dismiss', reason: 'spam' }, NOW), { kind: 'not_found' });
  const done = fakePool(reviewHandler({ reviewed: true }));
  assert.deepEqual(await new PostgresCommunityIntakeStore(done).review(reviewer, SUB, { decision: 'promote' }, NOW), { kind: 'already_reviewed' });
  assert.equal(inserts(done, 'signals').length, 0, 'no second signal');
  const dismissed = fakePool(reviewHandler());
  assert.deepEqual(await new PostgresCommunityIntakeStore(dismissed).review(reviewer, SUB, { decision: 'dismiss', reason: 'Not a health event' }, NOW), { kind: 'reviewed', decision: 'dismissed', signalId: null });
  assert.equal(inserts(dismissed, 'signals').length, 0);
  const merged = fakePool(reviewHandler());
  assert.deepEqual(await new PostgresCommunityIntakeStore(merged).review(reviewer, SUB, { decision: 'merge', signalId: SIG }, NOW), { kind: 'reviewed', decision: 'merged', signalId: SIG });
  const bad = fakePool(reviewHandler({ fkFail: true }));
  assert.deepEqual(await new PostgresCommunityIntakeStore(bad).review(reviewer, SUB, { decision: 'merge', signalId: SIG }, NOW), { kind: 'signal_not_found' });
  assert.ok(sqls(bad).includes('ROLLBACK'));
});

test('queue stats map the database answer and compute the age of the oldest pending report', async () => {
  const pool = fakePool((sql) => (sql.includes('percentile_cont') ? { rows: [{ pending: 4, urgent_pending: 1, oldest: new Date(NOW.getTime() - 30 * 3600000), reviewed30: 7, median_hours: '5.04' }] } : undefined));
  assert.deepEqual(await new PostgresCommunityIntakeStore(pool).queueStats(reviewer, NOW), { pending: 4, urgentPending: 1, oldestPendingAt: new Date(NOW.getTime() - 30 * 3600000).toISOString(), oldestPendingHours: 30, reviewedLast30Days: 7, medianHoursToReview: 5 });
  assert.equal(defaultSummary({ channel: 'ussd', category: 'other', urgent: false, narrative: null }).length >= 10, true);
});

/* ---------------------------------------------------------------- service */

function fakeStore() {
  const calls = { receive: [], reject: [] };
  return { calls, result: { kind: 'accepted', id: SUB },
    async receive(...a) { calls.receive.push(a); return this.result; }, async reject(...a) { calls.reject.push(a); } };
}
const cfg = () => cfgMod.loadCommunityIntakeConfig(goodEnv()).config;

test('service: a prompt step never touches the store or the sender number', async () => {
  const store = fakeStore();
  const svc = createCommunityIntakeService({ config: cfg(), store, now: () => NOW });
  const r = await svc.handle({ channel: 'ussd', destination: '*384*12#', sender: '+254700111222', text: '' });
  assert.equal(r.outcome, 'prompt');
  assert.equal(store.calls.receive.length + store.calls.reject.length, 0);
});

test('service: a finished report is stored with keyed hashes only; the number is in no store argument', async () => {
  const store = fakeStore();
  const svc = createCommunityIntakeService({ config: cfg(), store, now: () => NOW });
  const r = await svc.handle({ channel: 'ussd', destination: '*384 * 12#', sender: '+254 700 111 222', text: '1*3*1*1' });
  assert.equal(r.outcome, 'accepted'); assert.equal(r.end, true);
  const [orgId, input] = store.calls.receive[0];
  assert.equal(orgId, ORG);
  assert.match(input.senderHash, /^[0-9a-f]{64}$/); assert.match(input.duplicateHash, /^[0-9a-f]{64}$/);
  const dump = JSON.stringify(store.calls);
  assert.equal(dump.includes('254700111222'), false); assert.equal(dump.includes('700 111'), false);
  // Same person, same organisation: same hash. Different number: different hash.
  await svc.handle({ channel: 'ussd', destination: '*384*12#', sender: '254700111222', text: '1*3*1*1' });
  await svc.handle({ channel: 'ussd', destination: '*384*12#', sender: '254700999888', text: '1*3*1*1' });
  assert.equal(store.calls.receive[1][1].senderHash, input.senderHash);
  assert.notEqual(store.calls.receive[2][1].senderHash, input.senderHash);
});

test('service: the same number hashes differently in another organisation', async () => {
  const store = fakeStore();
  const env = goodEnv();
  env.COMMUNITY_INTAKE_CHANNELS = JSON.stringify([{ organizationId: ORG, ussdServiceCode: '*1#', areas: AREAS }, { organizationId: ORG2, ussdServiceCode: '*2#', areas: AREAS }]);
  const svc = createCommunityIntakeService({ config: cfgMod.loadCommunityIntakeConfig(env).config, store, now: () => NOW });
  await svc.handle({ channel: 'ussd', destination: '*1#', sender: '254700111222', text: '1*1*1*2' });
  await svc.handle({ channel: 'ussd', destination: '*2#', sender: '254700111222', text: '1*1*1*2' });
  assert.notEqual(store.calls.receive[0][1].senderHash, store.calls.receive[1][1].senderHash);
});

test('service: an SMS note with a phone number or ID label is refused, counted, and never stored', async () => {
  const store = fakeStore();
  const svc = createCommunityIntakeService({ config: cfg(), store, now: () => NOW });
  for (const note of ['call me on 0712345678', 'patient id: AB-1234 is sick']) {
    const r = await svc.handle({ channel: 'sms', destination: '23456', sender: '254700111222', text: `REPORT 1 1 ${note}` });
    assert.equal(r.outcome, 'refused_identifier'); assert.equal(r.reply, IDENTIFIER_REPLY);
  }
  assert.equal(store.calls.receive.length, 0);
  assert.equal(store.calls.reject.length, 2);
  assert.equal((await svc.handle({ channel: 'sms', destination: '23456', sender: '254700111222', text: 'REPORT 1 1 three people sick at the market' })).outcome, 'accepted');
});

test('service: duplicate says thank you, limits give one generic answer, unknown destinations reveal nothing', async () => {
  const store = fakeStore();
  const svc = createCommunityIntakeService({ config: cfg(), store, now: () => NOW });
  const msg = { channel: 'ussd', destination: '*384*12#', sender: '254700111222', text: '1*1*1*1' };
  store.result = { kind: 'duplicate' };
  const dup = await svc.handle(msg);
  assert.equal(dup.outcome, 'duplicate'); assert.match(dup.reply, /Thank you/);
  const replies = new Set();
  for (const reason of ['cooldown', 'organization_cap', 'sender_hourly', 'sender_daily']) { store.result = { kind: 'limited', reason }; replies.add((await svc.handle(msg)).reply); }
  assert.deepEqual([...replies], [LIMITED_REPLY]);
  const unknown = await svc.handle({ ...msg, destination: '*999#' });
  assert.equal(unknown.outcome, 'unknown_destination');
  assert.equal(store.calls.receive.length, 5);
  assert.equal((await svc.handle({ ...msg, sender: '12' })).outcome, 'unusable_sender');
});

/* ---------------------------------------------------------------- gateway */

test('Africa\'s Talking adapter: reads the callback shapes, rejects the malformed, formats CON and END', () => {
  assert.deepEqual(gw.parseUssdCallback({ serviceCode: '*384#', phoneNumber: '+2547', text: '1*2', sessionId: 'x' }), { channel: 'ussd', destination: '*384#', sender: '+2547', text: '1*2' });
  assert.equal(gw.parseUssdCallback({ serviceCode: '*384#', text: '' }), null);
  assert.deepEqual(gw.parseUssdCallback({ serviceCode: '*384#', phoneNumber: '+2547' }), { channel: 'ussd', destination: '*384#', sender: '+2547', text: '' }, 'a missing text field is a first dial');
  assert.equal(gw.parseUssdCallback({ serviceCode: '*384#', phoneNumber: '+2547', text: 5 }), null, 'a text field of the wrong type is still refused');
  assert.equal(gw.parseUssdCallback({ serviceCode: '*384#', phoneNumber: '1', text: 'x'.repeat(201) }), null);
  assert.deepEqual(gw.parseSmsCallback({ to: '23456', from: '+2547', text: 'REPORT 1 1' }), { channel: 'sms', destination: '23456', sender: '+2547', text: 'REPORT 1 1' });
  assert.equal(gw.parseSmsCallback('nope'), null);
  assert.equal(gw.formatUssdReply('Hello', false), 'CON Hello');
  assert.equal(gw.formatUssdReply('Bye', true), 'END Bye');
});

/* ----------------------------------------------------------------- routes */

function fakeApp() {
  const handlers = {}; let registered;
  const mk = () => ({ addContentTypeParser() {}, post: (url, o, h) => { handlers[`POST ${url}`] = h ?? o; }, get: (url, h) => { handlers[`GET ${url}`] = h; } });
  const app = { ...mk(), register: async (fn) => { registered = fn; await fn(mk()); } };
  app.post = (url, o, h) => { handlers[`POST ${url}`] = h ?? o; }; app.get = (url, h) => { handlers[`GET ${url}`] = h; };
  const gatewayScope = { addContentTypeParser() {}, post: (url, o, h) => { handlers[`POST ${url}`] = h; } };
  app.register = async (fn) => { await fn(gatewayScope); };
  return { app, handlers, registered: () => registered };
}
function fakeReply() {
  const r = { statusCode: 200, body: undefined, headers: {}, code(c) { r.statusCode = c; return r; }, type(t) { r.headers.type = t; return r; }, send(b) { r.body = b; return r; } };
  return r;
}

test('routes: secret comparison is exact', () => {
  assert.equal(routes.secretMatches('s'.repeat(30), 's'.repeat(30)), true);
  assert.equal(routes.secretMatches('s'.repeat(29), 's'.repeat(30)), false);
  assert.equal(routes.secretMatches(undefined, 's'.repeat(30)), false);
  assert.equal(routes.secretMatches(['s'.repeat(30)], 's'.repeat(30)), false);
});

async function wired({ allowedIps = [], smsSender, handle } = {}) {
  const f = fakeApp(); const store = fakeStore(); const smsLog = [];
  const config = { ...cfg(), allowedIps };
  const service = handle ? { handle } : createCommunityIntakeService({ config, store, now: () => NOW });
  await routes.registerCommunityIntakeRoutes(f.app, { resolveActor: async (h) => (h === 'good' ? reviewer : h === 'analyst' ? { ...reviewer, roles: ['analyst'] } : null), store: { ...store, listQueue: async () => [], queueStats: async () => ({}), review: async () => ({ kind: 'reviewed', decision: 'dismissed', signalId: null }) }, service, config, ...(smsSender ? { smsSender } : {}), now: () => NOW });
  return { f, store, smsLog };
}
const SECRET = 's'.repeat(30);

test('routes: the gateway must present the shared secret; wrong or missing is 401 and does nothing', async () => {
  const { f, store } = await wired();
  for (const headers of [{}, { 'x-intake-secret': 'wrong' }]) {
    const reply = fakeReply();
    await f.handlers['POST /inbound/community/ussd']({ headers, ip: '1.1.1.1', body: { serviceCode: '*384*12#', phoneNumber: '254700111222', text: '1*1*1*1' }, log: {} }, reply);
    assert.equal(reply.statusCode, 401);
  }
  assert.equal(store.calls.receive.length, 0);
});

test('routes: IP allow-list is enforced when configured', async () => {
  const { f } = await wired({ allowedIps: ['9.9.9.9'] });
  const call = async (ip) => { const r = fakeReply(); await f.handlers['POST /inbound/community/ussd']({ headers: { 'x-intake-secret': SECRET }, ip, body: { serviceCode: '*384*12#', phoneNumber: '254700111222', text: '' }, log: {} }, r); return r.statusCode; };
  assert.equal(await call('1.1.1.1'), 401);
  assert.equal(await call('9.9.9.9'), 200);
});

test('routes: USSD answers in CON/END plain text, and a server failure ends the session politely', async () => {
  const { f } = await wired();
  const r = fakeReply();
  await f.handlers['POST /inbound/community/ussd']({ headers: { 'x-intake-secret': SECRET }, ip: 'x', body: { serviceCode: '*384*12#', phoneNumber: '254700111222', text: '' }, log: {} }, r);
  assert.match(r.body, /^CON PubliPulse health report/); assert.equal(r.headers.type, 'text/plain');
  const failing = await wired({ handle: async () => { throw new Error('db down'); } });
  const r2 = fakeReply(); const logged = [];
  await failing.f.handlers['POST /inbound/community/ussd']({ headers: { 'x-intake-secret': SECRET }, ip: 'x', body: { serviceCode: '*384*12#', phoneNumber: '254700111222', text: '1' }, log: { error: (o) => logged.push(o) } }, r2);
  assert.match(r2.body, /^END Service unavailable/);
  assert.equal(JSON.stringify(logged).includes('254700111222'), false);
  const bad = fakeReply();
  await f.handlers['POST /inbound/community/ussd']({ headers: { 'x-intake-secret': SECRET }, ip: 'x', body: { nonsense: 1 }, log: {} }, bad);
  assert.equal(bad.statusCode, 400);
});

test('routes: SMS replies only when a sender is configured, never fails the report because of it, and the number goes nowhere else', async () => {
  const sent = [];
  const { f } = await wired({ smsSender: { send: async (to, text) => { sent.push([to, text]); } } });
  const r = fakeReply();
  await f.handlers['POST /inbound/community/sms']({ headers: { 'x-intake-secret': SECRET }, ip: 'x', body: { to: '23456', from: '254700111222', text: 'REPORT 1 1' }, log: { warn() {}, error() {} } }, r);
  assert.equal(r.statusCode, 200); assert.equal(r.body, '');
  assert.equal(sent.length, 1); assert.match(sent[0][1], /Thank you/);
  const broken = await wired({ smsSender: { send: async () => { throw new Error('gateway down'); } } });
  const r2 = fakeReply(); let warned = false;
  await broken.f.handlers['POST /inbound/community/sms']({ headers: { 'x-intake-secret': SECRET }, ip: 'x', body: { to: '23456', from: '254700111222', text: 'REPORT 1 1' }, log: { warn: () => { warned = true; }, error() {} } }, r2);
  assert.equal(r2.statusCode, 200); assert.equal(warned, true); assert.equal(broken.store.calls.receive.length, 1);
  const none = await wired();
  const r3 = fakeReply();
  await none.f.handlers['POST /inbound/community/sms']({ headers: { 'x-intake-secret': SECRET }, ip: 'x', body: { to: '99999', from: '254700111222', text: 'hello' }, log: {} }, r3);
  assert.equal(r3.body, '');
});

test('routes: review endpoints need an authenticated reviewer, owner or administrator', async () => {
  const { f } = await wired();
  const call = async (key, authorization, params = {}, body = undefined, query = {}) => { const r = fakeReply(); await f.handlers[key]({ headers: { authorization }, params, body, query, id: 'req' }, r); return r; };
  assert.equal((await call('GET /v1/community-intake/queue', undefined)).statusCode, 401);
  assert.equal((await call('GET /v1/community-intake/queue', 'analyst')).statusCode, 403);
  assert.equal((await call('GET /v1/community-intake/queue', 'good', {}, undefined, { status: 'bogus' })).statusCode, 400);
  assert.equal((await call('GET /v1/community-intake/queue', 'good', {}, undefined, { limit: '9999' })).statusCode, 400);
  assert.equal((await call('GET /v1/community-intake/queue', 'good')).statusCode, 200);
  assert.equal((await call('GET /v1/community-intake/stats', 'analyst')).statusCode, 403);
  const review = '/v1/community-intake/:submissionId/review';
  assert.equal((await call(`POST ${review}`, 'analyst', { submissionId: SUB }, { decision: 'dismiss', reason: 'spam' })).statusCode, 403);
  assert.equal((await call(`POST ${review}`, 'good', { submissionId: 'nope' }, { decision: 'dismiss', reason: 'spam' })).statusCode, 400);
  assert.equal((await call(`POST ${review}`, 'good', { submissionId: SUB }, { decision: 'wat' })).statusCode, 400);
  assert.equal((await call(`POST ${review}`, 'good', { submissionId: SUB }, { decision: 'dismiss', reason: 'spam' })).statusCode, 201);
});

/* --------------------------------------------------------------- migration */

test('migration 041: tenant isolation, append-only submissions and decisions, and no link from sender events to submissions', () => {
  const m = read('apps/api/migrations/041_community_intake.sql');
  for (const t of ['community_intake_submissions', 'community_intake_reviews', 'community_sender_events']) {
    assert.match(m, new RegExp(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`));
    assert.match(m, new RegExp(`CREATE POLICY ${t}_tenant_policy`));
  }
  assert.match(m, /BEFORE UPDATE OR DELETE ON community_intake_submissions/);
  assert.match(m, /BEFORE UPDATE OR DELETE ON community_intake_reviews/);
  const events = m.slice(m.indexOf('CREATE TABLE community_sender_events'), m.indexOf('CREATE INDEX community_sender_events_sender_idx'));
  assert.doesNotMatch(events, /submission|signal|narrative|phone|msisdn/i);
  assert.match(events, /sender_hash text NOT NULL CHECK \(sender_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  const subs = m.slice(m.indexOf('CREATE TABLE community_intake_submissions'), m.indexOf('CREATE TABLE community_intake_reviews'));
  assert.doesNotMatch(subs, /sender|phone|msisdn|hash/i);
});

test('server wiring: intake is off unless fully configured and a bad setup stops start-up', () => {
  const server = read('apps/api/src/server.ts'); const app = read('apps/api/src/app.ts');
  assert.match(server, /Community intake configuration is invalid/);
  assert.match(server, /intake\.status === 'ready'/);
  assert.match(app, /community_intake_not_configured/);
});

test('the gateway code path never logs a request body or a sender', () => {
  for (const f of ['community-intake-routes.ts', 'community-intake-service.ts', 'gateway-africastalking.ts']) {
    const s = read(api + f);
    assert.doesNotMatch(s, /log\.(info|debug|warn|error)\([^)]*(body|sender|phone|msg)/, f);
    assert.doesNotMatch(s, /console\./, f);
  }
});

test('documented minimum runtime grants cover what the intake store writes, and give no update or delete on append-only tables', () => {
  const doc = read('docs/DEPLOYMENT_SECURITY.md');
  for (const t of ['community_intake_submissions', 'community_intake_reviews', 'community_sender_events']) assert.match(doc, new RegExp(`GRANT SELECT, INSERT ON TABLE ${t} TO`));
  assert.match(doc, /GRANT USAGE, SELECT ON SEQUENCE community_sender_events_id_seq/);
  assert.doesNotMatch(doc, /GRANT[^;]*(UPDATE|DELETE)[^;]*ON TABLE community_/);
  const store = read(api + 'postgres-community-intake-store.ts');
  assert.doesNotMatch(store, /\bUPDATE community_|\bDELETE FROM community_/, 'the runtime store never updates or deletes intake rows');
});
