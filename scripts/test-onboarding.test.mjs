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
const dir = mkdtempSync(join(tmpdir(), 'pp-onboarding-'));
const build = (srcPath, out) => {
  let js = ts.transpileModule(read(srcPath), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  js = js.replace(/'@publipulse\/shared'/g, "'./rules.mjs'").replace(/'\.\/postgres-membership-store\.js'/g, "'./store.mjs'");
  writeFileSync(join(dir, out), js);
  return import(pathToFileURL(join(dir, out)).href);
};
const rules = await build('packages/shared/src/membership-rules.ts', 'rules.mjs');
const { PostgresMembershipStore, hashInvitationCode, newInvitationCode } = await build('apps/api/src/postgres-membership-store.ts', 'store.mjs');
const prov = await build('apps/api/src/provision-organization.ts', 'prov.mjs');

const ORG = '11111111-1111-4111-8111-111111111111';
const U1 = '22222222-2222-4222-8222-222222222222';
const U2 = '33333333-3333-4333-8333-333333333333';
const owner = { userId: U1, organizationId: ORG, roles: ['owner'] };
const admin = { userId: U1, organizationId: ORG, roles: ['administrator'] };
const NOW = new Date('2026-11-05T10:00:00Z');

/** Fake pool: records statements, answers by matching SQL text. */
function fakePool(handler = () => undefined) {
  const log = [];
  return { log, async connect() { return { async query(sql, values = []) { log.push({ sql, values }); return handler(sql, values) ?? { rows: [] }; }, release() { log.push({ sql: 'RELEASE', values: [] }); } }; } };
}
const sqls = (p) => p.log.map((l) => l.sql.replace(/\s+/g, ' ').trim());

test('rules: administrators cannot touch owners, administrators or auditors; owners can do everything', () => {
  assert.deepEqual(rules.assignableRoles(['administrator']), ['reviewer', 'investigator', 'responder', 'analyst', 'read_only']);
  assert.equal(rules.assignableRoles(['owner']).length, 8);
  assert.deepEqual(rules.assignableRoles(['analyst']), []);
  assert.equal(rules.decideMemberChange(['administrator'], 'owner', 'analyst').reason, 'cannot_manage_target_role');
  assert.equal(rules.decideMemberChange(['administrator'], 'analyst', 'administrator').reason, 'cannot_assign_role');
  assert.equal(rules.decideMemberChange(['administrator'], 'analyst', 'auditor').reason, 'cannot_assign_role');
  assert.equal(rules.decideMemberChange(['analyst'], 'read_only', 'responder').reason, 'not_a_manager');
  assert.equal(rules.decideMemberChange(['owner'], 'administrator', 'owner').allowed, true);
});

test('rules: the last active owner can be neither demoted nor suspended', () => {
  const t = { role: 'owner', active: true };
  assert.equal(rules.wouldRemoveLastOwner(t, { role: 'analyst' }, 0), true);
  assert.equal(rules.wouldRemoveLastOwner(t, { active: false }, 0), true);
  assert.equal(rules.wouldRemoveLastOwner(t, { active: false }, 1), false);
  assert.equal(rules.wouldRemoveLastOwner(t, {}, 0), false);
  assert.equal(rules.wouldRemoveLastOwner({ role: 'analyst', active: true }, { active: false }, 0), false);
});

test('rules: invitation status', () => {
  const base = { redeemedAt: null, revokedAt: null, expiresAt: '2026-11-06T00:00:00Z' };
  assert.equal(rules.invitationStatus(base, NOW), 'pending');
  assert.equal(rules.invitationStatus({ ...base, expiresAt: '2026-11-05T10:00:00Z' }, NOW), 'expired');
  assert.equal(rules.invitationStatus({ ...base, revokedAt: 'x' }, NOW), 'revoked');
  assert.equal(rules.invitationStatus({ ...base, redeemedAt: 'x' }, NOW), 'redeemed');
});

test('invitation codes are 256-bit, match the public pattern, and only their hash is stored', async () => {
  const code = newInvitationCode();
  assert.match(code, rules.INVITATION_CODE_PATTERN);
  assert.notEqual(code, newInvitationCode());
  const pool = fakePool((sql) => sql.startsWith('INSERT INTO organization_invitations') ? { rows: [{ id: 'i1', role: 'analyst', created_by: U1, created_at: NOW, expires_at: new Date(NOW.getTime() + 7 * 86400000), redeemed_at: null, revoked_at: null }] } : undefined);
  const store = new PostgresMembershipStore(pool, { newCode: () => code });
  const r = await store.createInvitation(admin, 'analyst', 7, NOW);
  assert.equal(r.code, code);
  assert.equal(r.invitation.status, 'pending');
  const all = JSON.stringify(pool.log);
  assert.ok(all.includes(hashInvitationCode(code)));
  assert.equal(all.includes(code), false, 'the plain code must never reach the database or audit log');
  assert.ok(sqls(pool).some((s) => s.includes("'organization_invitation.created'")));
});

test('an administrator cannot create an owner invitation, even by calling the store directly', async () => {
  const store = new PostgresMembershipStore(fakePool(() => undefined));
  await assert.rejects(store.createInvitation(admin, 'owner', 7, NOW), /role_not_assignable/);
});

test('redeem: joins once, sets tenant scope, audits, and refuses an unknown or used code', async () => {
  const code = newInvitationCode();
  const pool = fakePool((sql) => {
    if (sql.startsWith('SELECT user_id FROM organization_memberships')) return { rows: [] };
    if (sql.startsWith('UPDATE organization_invitations')) return { rows: [{ id: 'i1', role: 'responder' }] };
  });
  const store = new PostgresMembershipStore(pool);
  assert.deepEqual(await store.redeemInvitation(ORG, U2, code, NOW), { kind: 'joined', role: 'responder' });
  const s = sqls(pool);
  assert.ok(s.some((x) => x.includes("set_config('app.organization_id'")));
  assert.ok(s.some((x) => x.startsWith('INSERT INTO organization_memberships')));
  assert.ok(s.some((x) => x.includes("'organization_member.joined'")));
  assert.ok(s.includes('COMMIT'));

  const bad = fakePool((sql) => (sql.startsWith('SELECT user_id') ? { rows: [] } : sql.startsWith('UPDATE organization_invitations') ? { rows: [] } : undefined));
  assert.deepEqual(await new PostgresMembershipStore(bad).redeemInvitation(ORG, U2, code, NOW), { kind: 'invalid' });
  assert.equal(sqls(bad).some((x) => x.includes('audit_events')), false, 'failed redemptions must not write to the tenant audit log');
});

test('redeem: an existing member (even suspended) is not given a second membership or reactivated', async () => {
  const pool = fakePool((sql) => (sql.startsWith('SELECT user_id FROM organization_memberships') ? { rows: [{ user_id: U2 }] } : undefined));
  assert.deepEqual(await new PostgresMembershipStore(pool).redeemInvitation(ORG, U2, newInvitationCode(), NOW), { kind: 'already_member' });
  assert.equal(sqls(pool).some((x) => x.startsWith('UPDATE organization_invitations')), false, 'the code must not be consumed');
});

test('redeem: a race on the membership primary key reports already_member and rolls back', async () => {
  const pool = fakePool((sql) => {
    if (sql.startsWith('SELECT user_id')) return { rows: [] };
    if (sql.startsWith('UPDATE organization_invitations')) return { rows: [{ id: 'i1', role: 'analyst' }] };
    if (sql.startsWith('INSERT INTO organization_memberships')) throw Object.assign(new Error('dup'), { code: '23505' });
  });
  assert.deepEqual(await new PostgresMembershipStore(pool).redeemInvitation(ORG, U2, newInvitationCode(), NOW), { kind: 'already_member' });
  assert.ok(sqls(pool).includes('ROLLBACK'));
});

test('changeMember: locks owners first, refuses the last owner, and audits a successful change', async () => {
  const handler = (ownersAfter, target) => (sql) => {
    if (sql.includes("role='owner' AND active=true")) return { rows: ownersAfter.map((u) => ({ user_id: u })) };
    if (sql.startsWith('SELECT role, active')) return { rows: target ? [target] : [] };
    if (sql.startsWith('UPDATE organization_memberships')) return { rows: [{ user_id: U2, role: 'analyst', active: true, created_at: NOW, updated_at: NOW }] };
  };
  const lastOwner = fakePool(handler([U2], { role: 'owner', active: true }));
  assert.deepEqual(await new PostgresMembershipStore(lastOwner).changeMember(owner, U2, { role: 'analyst' }), { kind: 'last_owner' });
  assert.equal(sqls(lastOwner).some((x) => x.startsWith('UPDATE organization_memberships')), false);

  const ok = fakePool(handler([U1, U2], { role: 'owner', active: true }));
  const r = await new PostgresMembershipStore(ok).changeMember(owner, U2, { role: 'analyst' });
  assert.equal(r.kind, 'updated');
  const s = sqls(ok);
  assert.ok(s.findIndex((x) => x.includes('FOR UPDATE')) < s.findIndex((x) => x.startsWith('UPDATE')), 'locks come before the update');
  assert.ok(s.some((x) => x.includes("'organization_member.changed'")));

  const forbidden = fakePool(handler([U1], { role: 'administrator', active: true }));
  assert.deepEqual(await new PostgresMembershipStore(forbidden).changeMember(admin, U2, { active: false }), { kind: 'forbidden', reason: 'cannot_manage_target_role' });
  assert.deepEqual(await new PostgresMembershipStore(fakePool(handler([U1], null))).changeMember(owner, U2, { active: false }), { kind: 'not_found' });
});

test('provisioning: explicit country, owner invitation by default, audit row, one transaction', async () => {
  const pool = fakePool();
  const r = await prov.provisionOrganization(pool, { name: ' District Health Office ', countryCode: 'KE', invitationDays: 7 }, { newId: () => ORG, newCode: () => 'ppi_' + 'a'.repeat(43), now: () => NOW });
  assert.equal(r.ownerVia, 'invitation');
  assert.equal(r.organizationId, ORG);
  assert.equal(r.ownerInvitationCode, 'ppi_' + 'a'.repeat(43));
  const s = sqls(pool);
  assert.equal(s[0], 'BEGIN');
  assert.ok(s[1].includes("set_config('app.organization_id'"));
  assert.ok(s.some((x) => x.startsWith('INSERT INTO organizations (id,name,country_code)')));
  assert.deepEqual(pool.log.find((l) => l.sql.startsWith('INSERT INTO organizations')).values, [ORG, 'District Health Office', 'KE']);
  assert.ok(s.some((x) => x.includes("'organization.provisioned'")));
  assert.equal(s.at(-2), 'COMMIT');
  assert.equal(JSON.stringify(pool.log).includes('a'.repeat(43)), false, 'plain code must not be written');
});

test('provisioning with an existing owner identity creates the membership directly and rolls back on failure', async () => {
  const pool = fakePool();
  const r = await prov.provisionOrganization(pool, { name: 'Ministry', countryCode: 'UG', ownerUserId: U1, invitationDays: 7 }, { newId: () => ORG });
  assert.equal(r.ownerVia, 'membership');
  assert.equal(r.ownerInvitationCode, undefined);
  const failing = fakePool((sql) => { if (sql.startsWith('INSERT INTO organization_memberships')) throw new Error('boom'); });
  await assert.rejects(prov.provisionOrganization(failing, { name: 'Ministry', countryCode: 'UG', ownerUserId: U1, invitationDays: 7 }, { newId: () => ORG }), /boom/);
  assert.ok(sqls(failing).includes('ROLLBACK'));
  assert.ok(sqls(failing).includes('RELEASE'));
});

test('provisioning refuses bad input and the CLI has no default country', async () => {
  const bad = (o) => prov.validateProvisionInput({ name: 'Ok name', countryCode: 'UG', invitationDays: 7, ...o });
  assert.match(bad({ countryCode: 'ug' }), /country/);
  assert.match(bad({ name: 'x' }), /name/);
  assert.match(bad({ ownerUserId: 'not-a-uuid' }), /owner-sub/);
  assert.match(bad({ invitationDays: 31 }), /invite-days/);
  assert.match(prov.parseProvisionArgs(['--name', 'Ministry']).error, /--country is required/);
  assert.match(prov.parseProvisionArgs(['--name', 'Ministry', '--country', 'UG', '--bogus']).error, /unknown option/);
  const ok = prov.parseProvisionArgs(['--name', 'Ministry', '--country', 'UG', '--dry-run']);
  assert.equal(ok.dryRun, true);
  assert.equal(ok.input.invitationDays, 7);
});

test('routes: every route is authenticated and role-gated, redeem is rate-limited and answers one error for all failures', () => {
  const routes = read('apps/api/src/membership-routes.ts');
  assert.equal((routes.match(/canManageMembers\(actor\.roles\)/g) ?? []).length, 5);
  assert.match(routes, /cannot_change_own_membership/);
  assert.match(routes, /last_owner_required/);
  assert.match(routes, /rateLimit: \{ max: 10/);
  assert.equal((routes.match(/invitation_invalid/g) ?? []).length >= 2, true);
  assert.match(routes, /shownOnce: true/);
  const app = read('apps/api/src/app.ts'); const server = read('apps/api/src/server.ts');
  assert.match(app, /membership_service_not_configured/);
  assert.match(server, /new PostgresMembershipStore\(pool\)/);
  assert.match(server, /verifyToken,/);
});

test('migration 040 is tenant-isolated, never deletes, and removes the silent country default', () => {
  const m = read('apps/api/migrations/040_organization_onboarding.sql');
  assert.match(m, /DROP DEFAULT/);
  assert.match(m, /FORCE ROW LEVEL SECURITY/);
  assert.match(m, /BEFORE UPDATE OR DELETE ON organization_invitations/);
  assert.match(m, /UNIQUE \(organization_id, code_hash\)/);
  assert.doesNotMatch(m, /code text/i);
});

test('documented minimum runtime grants cover every write the membership store makes', () => {
  const doc = read('docs/DEPLOYMENT_SECURITY.md');
  assert.match(doc, /GRANT INSERT ON TABLE organization_memberships/);
  assert.match(doc, /GRANT UPDATE \(role, active, updated_at\) ON TABLE organization_memberships/);
  assert.match(doc, /GRANT SELECT, INSERT ON TABLE organization_invitations/);
  assert.match(doc, /GRANT UPDATE \(redeemed_at, redeemed_by, revoked_at, revoked_by\) ON TABLE organization_invitations/);
  assert.doesNotMatch(doc, /GRANT[^;]*INSERT[^;]*ON TABLE organizations /);
  const store = read('apps/api/src/postgres-membership-store.ts');
  // Every column the store updates must be in a granted column list.
  assert.match(store, /UPDATE organization_memberships SET role=COALESCE\(\$3,role\), active=COALESCE\(\$4,active\), updated_at=now\(\)/);
  assert.match(store, /UPDATE organization_invitations SET revoked_at=now\(\), revoked_by=\$3/);
  assert.match(store, /UPDATE organization_invitations SET redeemed_at=\$4, redeemed_by=\$2/);
});

test('migration 042 replaces the calendar-day invitation limit with exact hours, so daylight saving cannot reject a 30-day invitation', () => {
  const m = read('apps/api/migrations/042_invitation_expiry_exact_hours.sql');
  assert.match(m, /interval '720 hours'/);
  assert.match(m, /DROP CONSTRAINT/);
  assert.doesNotMatch(m.replace(/--.*$/gm, '').replace(/LIKE '%30 days%'/, ''), /interval '30 days'/);
  assert.equal(720, 30 * 24, 'the largest invitation the API allows is exactly 30 x 24 hours');
  assert.match(read('packages/shared/src/membership-rules.ts'), /INVITATION_MAX_DAYS = 30/);
});
