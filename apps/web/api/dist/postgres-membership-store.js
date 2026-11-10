import { createHash, randomBytes } from 'node:crypto';
import { assignableRoles, decideMemberChange, invitationStatus, wouldRemoveLastOwner } from '@publipulse/shared';
const iso = (v) => new Date(v).toISOString();
const isoOrNull = (v) => (v === null ? null : iso(v));
const mapMember = (r) => ({ userId: r.user_id, role: r.role, active: r.active, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) });
const mapInvite = (r, now) => {
    const base = { redeemedAt: isoOrNull(r.redeemed_at), revokedAt: isoOrNull(r.revoked_at), expiresAt: iso(r.expires_at) };
    return { id: r.id, role: r.role, status: invitationStatus(base, now), createdBy: r.created_by, createdAt: iso(r.created_at), ...base };
};
const MEMBER_COLS = 'user_id, role, active, created_at, updated_at';
const INVITE_COLS = 'id, role, created_by, created_at, expires_at, redeemed_at, revoked_at';
export const hashInvitationCode = (code) => createHash('sha256').update(code, 'utf8').digest('hex');
export const newInvitationCode = () => `ppi_${randomBytes(32).toString('base64url')}`;
export class PostgresMembershipStore {
    pool;
    newCode;
    constructor(pool, options = {}) {
        this.pool = pool;
        this.newCode = options.newCode ?? newInvitationCode;
    }
    async tx(organizationId, readOnly, fn) {
        const c = await this.pool.connect();
        try {
            await c.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
            await c.query("SELECT set_config('app.organization_id',$1,true)", [organizationId]);
            const result = await fn(c);
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
    async listMembers(actor, limit) {
        return this.tx(actor.organizationId, true, async (c) => {
            const r = await c.query(`SELECT ${MEMBER_COLS} FROM organization_memberships WHERE organization_id=$1 ORDER BY active DESC, role, created_at LIMIT $2`, [actor.organizationId, limit]);
            return r.rows.map(mapMember);
        });
    }
    async changeMember(actor, targetUserId, change) {
        return this.tx(actor.organizationId, false, async (c) => {
            // Lock every active owner first, always in the same order, so two owners cannot demote each other at the same moment.
            const owners = await c.query("SELECT user_id FROM organization_memberships WHERE organization_id=$1 AND role='owner' AND active=true ORDER BY user_id FOR UPDATE", [actor.organizationId]);
            const found = await c.query('SELECT role, active FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 FOR UPDATE', [actor.organizationId, targetUserId]);
            const target = found.rows[0];
            if (!target)
                return { kind: 'not_found' };
            const decision = decideMemberChange(actor.roles, target.role, change.role);
            if (!decision.allowed)
                return { kind: 'forbidden', reason: decision.reason };
            const others = owners.rows.filter((o) => o.user_id !== targetUserId).length;
            if (wouldRemoveLastOwner(target, change, others))
                return { kind: 'last_owner' };
            const updated = await c.query(`UPDATE organization_memberships SET role=COALESCE($3,role), active=COALESCE($4,active), updated_at=now() WHERE organization_id=$1 AND user_id=$2 RETURNING ${MEMBER_COLS}`, [actor.organizationId, targetUserId, change.role ?? null, change.active ?? null]);
            const row = updated.rows[0];
            if (!row)
                throw new Error('Membership update returned no row');
            await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'organization_member.changed','organization_member',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, targetUserId, JSON.stringify({ fromRole: target.role, toRole: row.role, wasActive: target.active, isActive: row.active })]);
            return { kind: 'updated', member: mapMember(row) };
        });
    }
    async createInvitation(actor, role, expiresInDays, now) {
        // Defence in depth: the route has already checked this, the store never trusts the caller alone.
        if (!assignableRoles(actor.roles).includes(role))
            throw new Error('role_not_assignable');
        const code = this.newCode();
        const expiresAt = new Date(now.getTime() + expiresInDays * 86_400_000);
        return this.tx(actor.organizationId, false, async (c) => {
            const r = await c.query(`INSERT INTO organization_invitations (organization_id,role,code_hash,created_by,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING ${INVITE_COLS}`, [actor.organizationId, role, hashInvitationCode(code), actor.userId, now.toISOString(), expiresAt.toISOString()]);
            const row = r.rows[0];
            if (!row)
                throw new Error('Invitation insert returned no row');
            await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'organization_invitation.created','organization_invitation',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, row.id, JSON.stringify({ role, expiresInDays })]);
            return { invitation: mapInvite(row, now), code };
        });
    }
    async listInvitations(actor, limit, now) {
        return this.tx(actor.organizationId, true, async (c) => {
            const r = await c.query(`SELECT ${INVITE_COLS} FROM organization_invitations WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2`, [actor.organizationId, limit]);
            return r.rows.map((row) => mapInvite(row, now));
        });
    }
    async revokeInvitation(actor, invitationId) {
        return this.tx(actor.organizationId, false, async (c) => {
            const updated = await c.query('UPDATE organization_invitations SET revoked_at=now(), revoked_by=$3 WHERE organization_id=$1 AND id=$2 AND redeemed_at IS NULL AND revoked_at IS NULL RETURNING id', [actor.organizationId, invitationId, actor.userId]);
            if (!updated.rows[0]) {
                const exists = await c.query('SELECT id FROM organization_invitations WHERE organization_id=$1 AND id=$2', [actor.organizationId, invitationId]);
                return exists.rows[0] ? 'not_pending' : 'not_found';
            }
            await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'organization_invitation.revoked','organization_invitation',$3,'success','{}'::jsonb)", [actor.organizationId, actor.userId, invitationId]);
            return 'revoked';
        });
    }
    async redeemInvitation(organizationId, userId, code, now) {
        try {
            return await this.tx(organizationId, false, async (c) => {
                const existing = await c.query('SELECT user_id FROM organization_memberships WHERE organization_id=$1 AND user_id=$2', [organizationId, userId]);
                // A person who already has a membership (even a suspended one) never gets a second one or a reactivation from a code.
                if (existing.rows[0])
                    return { kind: 'already_member' };
                const closed = await c.query('UPDATE organization_invitations SET redeemed_at=$4, redeemed_by=$2 WHERE organization_id=$1 AND code_hash=$3 AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at>$4 RETURNING id, role', [organizationId, userId, hashInvitationCode(code), now.toISOString()]);
                const invitation = closed.rows[0];
                if (!invitation)
                    return { kind: 'invalid' };
                await c.query('INSERT INTO organization_memberships (organization_id,user_id,role) VALUES($1,$2,$3)', [organizationId, userId, invitation.role]);
                // Only a valid code reaches this audit row. Failed attempts are deliberately not audited: the organisation id is
                // supplied by an unauthenticated-as-member caller, so auditing failures would let anyone write into another tenant's log.
                await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'organization_member.joined','organization_member',$2,'success',$3::jsonb)", [organizationId, userId, JSON.stringify({ role: invitation.role, viaInvitation: true })]);
                return { kind: 'joined', role: invitation.role };
            });
        }
        catch (e) {
            // Two simultaneous redemptions by the same person: the second hits the membership primary key.
            if (e.code === '23505')
                return { kind: 'already_member' };
            throw e;
        }
    }
}
