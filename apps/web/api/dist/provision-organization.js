import { randomUUID } from 'node:crypto';
import { hashInvitationCode, newInvitationCode } from './postgres-membership-store.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateProvisionInput(i) {
    const name = i.name.trim();
    if (name.length < 2 || name.length > 160)
        return 'name must be 2 to 160 characters';
    if (!/^[A-Z]{2}$/.test(i.countryCode))
        return 'country must be a two-letter upper-case ISO code, for example UG';
    if (i.ownerUserId !== undefined && !UUID.test(i.ownerUserId))
        return 'owner-sub must be a UUID (the OIDC sub claim)';
    if (!Number.isInteger(i.invitationDays) || i.invitationDays < 1 || i.invitationDays > 30)
        return 'invite-days must be a whole number from 1 to 30';
    return null;
}
export async function provisionOrganization(pool, input, deps = {}) {
    const problem = validateProvisionInput(input);
    if (problem)
        throw new Error(`invalid_provision_input: ${problem}`);
    const id = (deps.newId ?? randomUUID)();
    const now = (deps.now ?? (() => new Date()))();
    const c = await pool.connect();
    try {
        await c.query('BEGIN');
        // Row-level security applies to the organisation's own row too, so the new id is the tenant scope for this transaction.
        await c.query("SELECT set_config('app.organization_id',$1,true)", [id]);
        await c.query('INSERT INTO organizations (id,name,country_code) VALUES($1,$2,$3)', [id, input.name.trim(), input.countryCode]);
        let result;
        if (input.ownerUserId) {
            await c.query("INSERT INTO organization_memberships (organization_id,user_id,role) VALUES($1,$2,'owner')", [id, input.ownerUserId]);
            result = { organizationId: id, ownerVia: 'membership' };
        }
        else {
            const code = (deps.newCode ?? newInvitationCode)();
            const expiresAt = new Date(now.getTime() + input.invitationDays * 86_400_000);
            await c.query("INSERT INTO organization_invitations (organization_id,role,code_hash,created_at,expires_at) VALUES($1,'owner',$2,$3,$4)", [id, hashInvitationCode(code), now.toISOString(), expiresAt.toISOString()]);
            result = { organizationId: id, ownerVia: 'invitation', ownerInvitationCode: code, invitationExpiresAt: expiresAt.toISOString() };
        }
        await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'organization.provisioned','organization',$1,'success',$3::jsonb)", [id, input.ownerUserId ?? null, JSON.stringify({ countryCode: input.countryCode, ownerVia: result.ownerVia, provisionedBy: 'operator' })]);
        await c.query('COMMIT');
        return result;
    }
    catch (e) {
        try {
            await c.query('ROLLBACK');
        }
        catch { /* keep the original failure */ }
        throw e;
    }
    finally {
        c.release();
    }
}
export function parseProvisionArgs(argv) {
    const known = new Set(['--name', '--country', '--owner-sub', '--invite-days', '--dry-run']);
    const values = new Map();
    let dryRun = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (!known.has(a))
            return { dryRun, error: `unknown option ${a}` };
        if (a === '--dry-run') {
            dryRun = true;
            continue;
        }
        const v = argv[i + 1];
        if (v === undefined || v.startsWith('--'))
            return { dryRun, error: `${a} needs a value` };
        values.set(a, v);
        i += 1;
    }
    const name = values.get('--name');
    const country = values.get('--country');
    if (!name)
        return { dryRun, error: '--name is required' };
    if (!country)
        return { dryRun, error: '--country is required (no default: pass the two-letter code explicitly)' };
    const days = values.has('--invite-days') ? Number(values.get('--invite-days')) : 7;
    const owner = values.get('--owner-sub');
    const input = { name, countryCode: country, invitationDays: days, ...(owner !== undefined ? { ownerUserId: owner } : {}) };
    const problem = validateProvisionInput(input);
    return problem ? { dryRun, error: problem } : { dryRun, input };
}
