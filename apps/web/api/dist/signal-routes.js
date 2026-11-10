import { SignalIntakeSchema, SignalStatusTransitionSchema } from '@publipulse/shared';
import { canSubmitSignals, canTransitionSignal } from './signal-store.js';
import { parseQueryLimit } from './request-validation.js';
export async function registerSignalRoutes(app, options) {
    app.post('/v1/signals', async (request, reply) => {
        const actor = await options.resolveActor(request.headers.authorization, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: request.id });
        if (!canSubmitSignals(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        const parsed = SignalIntakeSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({
                error: 'invalid_signal',
                issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
                requestId: request.id
            });
        }
        const result = await options.store.createIdempotent(actor, parsed.data);
        if (result.kind === 'conflict') {
            return reply.code(409).send({ error: 'idempotency_conflict', requestId: request.id });
        }
        return reply.code(result.kind === 'created' ? 201 : 200).send({ signal: result.signal, replayed: result.kind === 'replayed' });
    });
    app.post('/v1/signals/:signalId/milestones/:milestone', async (request, reply) => {
        const actor = await options.resolveActor(request.headers.authorization, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: request.id });
        if (!actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'investigator', 'responder'].includes(r)))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        const { signalId, milestone } = request.params;
        if (!signalId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(signalId) || !['notified', 'response_started'].includes(milestone ?? ''))
            return reply.code(400).send({ error: 'invalid_milestone', requestId: request.id });
        const result = await options.store.recordMilestone(actor, signalId, milestone);
        if (result === 'not_found')
            return reply.code(404).send({ error: 'signal_not_found', requestId: request.id });
        return reply.code(201).send({ recorded: true, milestone, requestId: request.id });
    });
    app.patch('/v1/signals/:signalId/status', async (request, reply) => {
        const actor = await options.resolveActor(request.headers.authorization, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: request.id });
        const parsed = SignalStatusTransitionSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_status_transition', requestId: request.id });
        if (!canTransitionSignal(actor, parsed.data.status))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        const params = request.params;
        if (!params.signalId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.signalId)) {
            return reply.code(400).send({ error: 'invalid_signal_id', requestId: request.id });
        }
        const result = await options.store.transitionStatus(actor, params.signalId, parsed.data.expectedVersion, parsed.data.status);
        if (result.kind === 'not_found')
            return reply.code(404).send({ error: 'signal_not_found', requestId: request.id });
        if (result.kind === 'conflict')
            return reply.code(409).send({ error: 'signal_version_conflict', requestId: request.id });
        if (result.kind === 'invalid_transition')
            return reply.code(409).send({ error: 'invalid_status_transition', currentStatus: result.currentStatus, requestId: request.id });
        return reply.send({ signal: result.signal });
    });
    app.get('/v1/signals', async (request, reply) => {
        const actor = await options.resolveActor(request.headers.authorization, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: request.id });
        if (!actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only'].includes(role))) {
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        }
        const query = request.query;
        const limit = parseQueryLimit(query.limit);
        if (limit === null) {
            return reply.code(400).send({ error: 'invalid_limit', requestId: request.id });
        }
        const signals = await options.store.listForOrganization(actor.organizationId, limit);
        return reply.send({ signals });
    });
}
