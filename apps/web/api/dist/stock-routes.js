import { StockSnapshotSchema } from '@publipulse/shared';
import { canReadStock, canRecordStock } from './stock-store.js';
import { parseQueryLimit } from './request-validation.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function registerStockRoutes(app, opts) {
    const now = opts.now ?? (() => new Date());
    app.post('/v1/stock/snapshots', async (req, reply) => { const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined); if (!actor)
        return reply.code(401).send({ error: 'authentication_required', requestId: req.id }); if (!canRecordStock(actor))
        return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id }); const clientMutationId = typeof req.headers['x-client-mutation-id'] === 'string' ? req.headers['x-client-mutation-id'] : undefined; if (clientMutationId && !UUID.test(clientMutationId))
        return reply.code(400).send({ error: 'invalid_client_mutation_id', requestId: req.id }); const parsed = StockSnapshotSchema.safeParse(req.body); if (!parsed.success)
        return reply.code(400).send({ error: 'invalid_stock_snapshot', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code })), requestId: req.id }); if (Date.parse(parsed.data.observedAt) > now().getTime() + 5 * 60_000)
        return reply.code(400).send({ error: 'observed_at_in_future', requestId: req.id }); const r = await opts.store.record(actor, parsed.data, clientMutationId); if (r.kind === 'mutation_conflict')
        return reply.code(409).send({ error: 'client_mutation_id_conflict', requestId: req.id }); return reply.code(r.kind === 'replayed' ? 200 : 201).send({ snapshot: r.snapshot, replayed: r.kind === 'replayed' }); });
    app.get('/v1/stock/forecast', async (req, reply) => { const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined); if (!actor)
        return reply.code(401).send({ error: 'authentication_required', requestId: req.id }); if (!canReadStock(actor))
        return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id }); const q = req.query; const limit = parseQueryLimit(q.limit); if (limit === null)
        return reply.code(400).send({ error: 'invalid_limit', requestId: req.id }); const lead = parseQueryLimit(q.leadTimeDays, 7, 180); if (lead === null)
        return reply.code(400).send({ error: 'invalid_lead_time_days', requestId: req.id }); return reply.send({ series: await opts.store.forecast(actor, limit, lead, now()), assumptions: { steadyConsumption: true, pendingDeliveriesIncluded: false, leadTimeDays: lead }, signalsCreatedAutomatically: false }); });
}
