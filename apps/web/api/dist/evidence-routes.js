import { EvidenceIntakeSchema } from '@publipulse/shared';
import { canManageEvidence, canReadEvidence } from './evidence-store.js';
import { parseQueryLimit } from './request-validation.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function registerEvidenceRoutes(app, options) {
    app.post('/v1/signals/:signalId/evidence', async (request, reply) => {
        const actor = await options.resolveActor(request.headers.authorization, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: request.id });
        if (!canManageEvidence(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        const { signalId } = request.params;
        if (!signalId || !UUID.test(signalId))
            return reply.code(400).send({ error: 'invalid_signal_id', requestId: request.id });
        const parsed = EvidenceIntakeSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_evidence', issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })), requestId: request.id });
        const result = await options.store.create(actor, signalId, parsed.data);
        if (result.kind === 'signal_not_found')
            return reply.code(404).send({ error: 'signal_not_found', requestId: request.id });
        return reply.code(201).send({ evidence: result.evidence });
    });
    app.get('/v1/signals/:signalId/evidence', async (request, reply) => {
        const actor = await options.resolveActor(request.headers.authorization, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: request.id });
        if (!canReadEvidence(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        const { signalId } = request.params;
        if (!signalId || !UUID.test(signalId))
            return reply.code(400).send({ error: 'invalid_signal_id', requestId: request.id });
        const query = request.query;
        const limit = parseQueryLimit(query.limit);
        if (limit === null)
            return reply.code(400).send({ error: 'invalid_limit', requestId: request.id });
        const evidence = await options.store.list(actor, signalId, limit);
        if (evidence === null)
            return reply.code(404).send({ error: 'signal_not_found', requestId: request.id });
        return reply.send({ evidence });
    });
}
