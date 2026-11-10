import { Dhis2UpstreamEventSchema, normalizeDhis2UpstreamEvent } from '@publipulse/shared';
import { canReadInteroperability } from './interoperability-store.js';
function canIngest(actor) { return actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'responder'].includes(r)); }
export async function registerUpstreamEventRoutes(app, opts) {
    app.post('/v1/interoperability/upstream/dhis2/events', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canIngest(actor) || !canReadInteroperability(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const parsed = Dhis2UpstreamEventSchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_dhis2_upstream_event', requestId: req.id, issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code })) });
        const profile = (await opts.interoperabilityStore.listIntegrationProfiles(actor)).find(p => p.id === parsed.data.integrationProfileId && p.provider === 'dhis2' && p.status === 'verified');
        if (!profile)
            return reply.code(409).send({ error: 'dhis2_integration_profile_not_active', requestId: req.id });
        const result = await opts.store.ingest(actor, normalizeDhis2UpstreamEvent(parsed.data));
        if (result.kind === 'profile_missing')
            return reply.code(409).send({ error: 'dhis2_integration_profile_not_active', requestId: req.id });
        if (result.kind === 'conflict')
            return reply.code(409).send({ error: 'upstream_event_conflict', requestId: req.id });
        return reply.code(result.kind === 'replayed' ? 200 : 201).send({ accepted: true, signalId: result.signal.id, replayed: result.kind === 'replayed', upstream: { provider: parsed.data.provider, externalEventId: parsed.data.externalEventId, contractVersion: parsed.data.contractVersion }, externalTransferPerformed: false, requestId: req.id });
    });
}
