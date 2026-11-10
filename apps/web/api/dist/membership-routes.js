import { InvitationCreateSchema, InvitationRedeemSchema, MemberChangeSchema, assignableRoles, canManageMembers } from '@publipulse/shared';
import { parseQueryLimit } from './request-validation.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const orgHeader = (h) => (typeof h === 'string' ? h : undefined);
export async function registerMembershipRoutes(app, opts) {
    const now = opts.now ?? (() => new Date());
    app.get('/v1/members', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, orgHeader(req.headers['x-organization-id']));
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canManageMembers(actor.roles))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const limit = parseQueryLimit(req.query.limit);
        if (limit === null)
            return reply.code(400).send({ error: 'invalid_limit', requestId: req.id });
        return reply.send({ members: await opts.store.listMembers(actor, limit), assignableRoles: assignableRoles(actor.roles) });
    });
    app.patch('/v1/members/:userId', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, orgHeader(req.headers['x-organization-id']));
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canManageMembers(actor.roles))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const { userId } = req.params;
        if (!userId || !UUID.test(userId))
            return reply.code(400).send({ error: 'invalid_user_id', requestId: req.id });
        // Nobody changes their own role or suspends themselves: it prevents self-promotion and accidental lock-out.
        if (userId.toLowerCase() === actor.userId.toLowerCase())
            return reply.code(403).send({ error: 'cannot_change_own_membership', requestId: req.id });
        const parsed = MemberChangeSchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_member_change', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })), requestId: req.id });
        const change = {};
        if (parsed.data.role !== undefined)
            change.role = parsed.data.role;
        if (parsed.data.active !== undefined)
            change.active = parsed.data.active;
        const r = await opts.store.changeMember(actor, userId, change);
        if (r.kind === 'not_found')
            return reply.code(404).send({ error: 'member_not_found', requestId: req.id });
        if (r.kind === 'forbidden')
            return reply.code(403).send({ error: 'insufficient_permissions', reason: r.reason, requestId: req.id });
        if (r.kind === 'last_owner')
            return reply.code(409).send({ error: 'last_owner_required', requestId: req.id });
        return reply.send({ member: r.member });
    });
    app.post('/v1/invitations', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, orgHeader(req.headers['x-organization-id']));
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canManageMembers(actor.roles))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const parsed = InvitationCreateSchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_invitation', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })), requestId: req.id });
        if (!assignableRoles(actor.roles).includes(parsed.data.role))
            return reply.code(403).send({ error: 'insufficient_permissions', reason: 'cannot_assign_role', requestId: req.id });
        const created = await opts.store.createInvitation(actor, parsed.data.role, parsed.data.expiresInDays, now());
        // The code is returned exactly once, here. It is never stored or listed.
        return reply.code(201).send({ invitation: created.invitation, code: created.code, shownOnce: true });
    });
    app.get('/v1/invitations', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, orgHeader(req.headers['x-organization-id']));
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canManageMembers(actor.roles))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const limit = parseQueryLimit(req.query.limit);
        if (limit === null)
            return reply.code(400).send({ error: 'invalid_limit', requestId: req.id });
        return reply.send({ invitations: await opts.store.listInvitations(actor, limit, now()) });
    });
    app.post('/v1/invitations/:invitationId/revoke', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, orgHeader(req.headers['x-organization-id']));
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canManageMembers(actor.roles))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const { invitationId } = req.params;
        if (!invitationId || !UUID.test(invitationId))
            return reply.code(400).send({ error: 'invalid_invitation_id', requestId: req.id });
        const r = await opts.store.revokeInvitation(actor, invitationId);
        if (r === 'not_found')
            return reply.code(404).send({ error: 'invitation_not_found', requestId: req.id });
        if (r === 'not_pending')
            return reply.code(409).send({ error: 'invitation_not_pending', requestId: req.id });
        return reply.send({ revoked: true });
    });
    // Redeeming needs a verified identity but, by definition, no membership yet, so it cannot use resolveActor.
    app.post('/v1/invitations/redeem', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
        if (!opts.verifyToken)
            return reply.code(503).send({ error: 'invitation_redemption_not_configured', requestId: req.id });
        const header = req.headers.authorization;
        const match = header && header.length <= 12_000 ? /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(header) : null;
        const organizationId = orgHeader(req.headers['x-organization-id']);
        if (!match || !organizationId || !UUID.test(organizationId))
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        let sub;
        try {
            sub = (await opts.verifyToken(match[1])).sub;
        }
        catch {
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        }
        if (typeof sub !== 'string' || !UUID.test(sub))
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        const parsed = InvitationRedeemSchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invitation_invalid', requestId: req.id });
        const r = await opts.store.redeemInvitation(organizationId, sub, parsed.data.code, now());
        // One answer for unknown organisation, wrong code, used, expired and revoked, so the endpoint tells a guesser nothing.
        if (r.kind === 'invalid')
            return reply.code(400).send({ error: 'invitation_invalid', requestId: req.id });
        if (r.kind === 'already_member')
            return reply.code(409).send({ error: 'already_member', requestId: req.id });
        return reply.code(201).send({ joined: true, role: r.role });
    });
}
