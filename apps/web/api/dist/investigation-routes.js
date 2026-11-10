import { InvestigationIntakeSchema, InvestigationUpdateSchema } from '@publipulse/shared';
import { canCreateInvestigation, canReadInvestigations } from './investigation-store.js';
import { parseQueryLimit } from './request-validation.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function registerInvestigationRoutes(app, options) {
    app.post('/v1/signals/:signalId/investigations', async (request, reply) => {
        const actor = await options.resolveActor(request.headers.authorization, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: request.id });
        if (!canCreateInvestigation(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        const { signalId } = request.params;
        if (!signalId || !UUID.test(signalId))
            return reply.code(400).send({ error: 'invalid_signal_id', requestId: request.id });
        const parsed = InvestigationIntakeSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_investigation', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })), requestId: request.id });
        const result = await options.store.create(actor, signalId, parsed.data);
        if (result.kind === 'signal_not_found')
            return reply.code(404).send({ error: 'signal_not_found', requestId: request.id });
        if (result.kind === 'invalid_owner')
            return reply.code(400).send({ error: 'owner_not_active_member', requestId: request.id });
        return reply.code(201).send({ investigation: result.investigation });
    });
    app.get('/v1/signals/:signalId/investigations', async (request, reply) => {
        const actor = await options.resolveActor(request.headers.authorization, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: request.id });
        if (!canReadInvestigations(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        const { signalId } = request.params;
        if (!signalId || !UUID.test(signalId))
            return reply.code(400).send({ error: 'invalid_signal_id', requestId: request.id });
        const q = request.query;
        const limit = parseQueryLimit(q.limit);
        if (limit === null)
            return reply.code(400).send({ error: 'invalid_limit', requestId: request.id });
        const investigations = await options.store.list(actor, signalId, limit);
        if (investigations === null)
            return reply.code(404).send({ error: 'signal_not_found', requestId: request.id });
        return reply.send({ investigations });
    });
    app.patch('/v1/investigations/:investigationId', async (request, reply) => {
        const actor = await options.resolveActor(request.headers.authorization, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: request.id });
        if (!actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator'].includes(role)))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        const { investigationId } = request.params;
        if (!investigationId || !UUID.test(investigationId))
            return reply.code(400).send({ error: 'invalid_investigation_id', requestId: request.id });
        const parsed = InvestigationUpdateSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_investigation_update', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })), requestId: request.id });
        const result = await options.store.update(actor, investigationId, parsed.data);
        if (result.kind === 'not_found')
            return reply.code(404).send({ error: 'investigation_not_found', requestId: request.id });
        if (result.kind === 'forbidden')
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        if (result.kind === 'conflict')
            return reply.code(409).send({ error: 'investigation_version_conflict_or_terminal', requestId: request.id });
        return reply.send({ investigation: result.investigation });
    });
}
