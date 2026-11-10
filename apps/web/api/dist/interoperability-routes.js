import { CountryCodeSchema, DataSharingPolicySchema, InteroperabilityContractSchema, ExchangeReceiptSchema, ReconciliationSnapshotInputSchema } from '@publipulse/shared';
import { canManageSharingPolicy, canReadInteroperability } from './interoperability-store.js';
async function actorOf(resolveActor, req) {
    return resolveActor(typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined);
}
export async function registerInteroperabilityRoutes(app, opts) {
    app.get('/v1/interoperability/countries', async (_req, reply) => reply.send({ countries: await opts.store.listCountries() }));
    app.get('/v1/interoperability/indicators', async (req, reply) => {
        const q = req.query;
        if (q.countryCode && !CountryCodeSchema.safeParse(q.countryCode).success)
            return reply.code(400).send({ error: 'invalid_country_code', requestId: req.id });
        return reply.send({ indicators: await opts.store.listIndicators(q.countryCode) });
    });
    app.get('/v1/interoperability/programmes', async (req, reply) => {
        const actor = await actorOf(opts.resolveActor, req);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadInteroperability(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        return reply.send({ programmes: await opts.store.listProgrammes(actor) });
    });
    app.get('/v1/governance/sharing-policies', async (req, reply) => {
        const actor = await actorOf(opts.resolveActor, req);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadInteroperability(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        return reply.send({ policies: await opts.store.listSharingPolicies(actor) });
    });
    app.post('/v1/governance/sharing-policies', async (req, reply) => {
        const actor = await actorOf(opts.resolveActor, req);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canManageSharingPolicy(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const parsed = DataSharingPolicySchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_sharing_policy', requestId: req.id });
        try {
            const policy = await opts.store.createSharingPolicy(actor, parsed.data);
            return reply.code(201).send({ policy });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'programme_not_found')
                return reply.code(400).send({ error: 'programme_not_found', requestId: req.id });
            if (error instanceof Error && error.message === 'idempotency_conflict')
                return reply.code(409).send({ error: 'idempotency_conflict', requestId: req.id });
            throw error;
        }
    });
    app.post('/v1/interoperability/exchange-requests', async (req, reply) => {
        const actor = await actorOf(opts.resolveActor, req);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadInteroperability(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined;
        if (!idempotencyKey)
            return reply.code(400).send({ error: 'idempotency_key_required', requestId: req.id });
        if (idempotencyKey.length < 8 || idempotencyKey.length > 200 || /[\r\n]/.test(idempotencyKey))
            return reply.code(400).send({ error: 'invalid_idempotency_key', requestId: req.id });
        const requestBody = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
            ? req.body
            : {};
        const parsed = InteroperabilityContractSchema.safeParse({ ...requestBody, requestedBy: actor.userId });
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_interoperability_contract', requestId: req.id });
        try {
            const receipt = await opts.store.requestExchange(actor, parsed.data, idempotencyKey);
            const validated = ExchangeReceiptSchema.safeParse(receipt);
            if (!validated.success)
                throw new Error('invalid_exchange_receipt');
            return reply.code(receipt.status === 'rejected' ? 409 : 202).send({ receipt, externalTransferPerformed: false, disclaimer: 'This endpoint records and validates an exchange request. No external-system transfer is performed until a verified provider adapter is explicitly enabled.' });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'programme_not_found')
                return reply.code(400).send({ error: 'programme_not_found', requestId: req.id });
            if (error instanceof Error && error.message === 'idempotency_conflict')
                return reply.code(409).send({ error: 'idempotency_conflict', requestId: req.id });
            if (error instanceof Error && error.message === 'transport_disabled')
                return reply.code(503).send({ error: 'external_transport_disabled', requestId: req.id });
            throw error;
        }
    });
    app.post('/v1/interoperability/reconciliation-snapshots', async (req, reply) => {
        const actor = await actorOf(opts.resolveActor, req);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadInteroperability(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const parsed = ReconciliationSnapshotInputSchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_reconciliation_snapshot', requestId: req.id, issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code })) });
        try {
            const snapshot = await opts.store.recordReconciliation(actor, parsed.data);
            return reply.code(201).send({ snapshot, externalTransferPerformed: false, disclaimer: 'This records reconciliation evidence supplied by an authorized pilot adapter. It does not assert that the external system accepted or changed any record.' });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'exchange_job_not_found')
                return reply.code(404).send({ error: 'exchange_job_not_found', requestId: req.id });
            if (error instanceof Error && error.message === 'provider_mismatch')
                return reply.code(409).send({ error: 'provider_mismatch', requestId: req.id });
            if (error instanceof Error && error.message === 'reconciliation_already_recorded')
                return reply.code(409).send({ error: 'reconciliation_already_recorded', requestId: req.id });
            throw error;
        }
    });
    app.get('/v1/interoperability/integration-profiles', async (req, reply) => {
        const actor = await actorOf(opts.resolveActor, req);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadInteroperability(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        return reply.send({ profiles: await opts.store.listIntegrationProfiles(actor), disclaimer: 'Metadata only. A configured profile is not proof of a live external-system integration.' });
    });
}
