import { DecisionIntakeSchema, ResponseActionIntakeSchema, ResponseActionUpdateSchema } from '@publipulse/shared';
import { canCreateResponseActions, canManageDecisions, canReadDecisionsActions } from './decision-action-store.js';
import { parseQueryLimit } from './request-validation.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function registerDecisionActionRoutes(app, opts) {
    const actorFor = async (request) => opts.resolveActor(typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
    app.post('/v1/signals/:signalId/decisions', async (req, reply) => { const actor = await actorFor(req); if (!actor)
        return reply.code(401).send({ error: 'authentication_required', requestId: req.id }); if (!canManageDecisions(actor))
        return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id }); const { signalId } = req.params; if (!signalId || !UUID.test(signalId))
        return reply.code(400).send({ error: 'invalid_signal_id', requestId: req.id }); const parsed = DecisionIntakeSchema.safeParse(req.body); if (!parsed.success)
        return reply.code(400).send({ error: 'invalid_decision', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code })), requestId: req.id }); const r = await opts.store.createDecision(actor, signalId, parsed.data); if (r.kind === 'signal_not_found')
        return reply.code(404).send({ error: 'signal_not_found', requestId: req.id }); if (r.kind === 'investigation_not_found')
        return reply.code(404).send({ error: 'investigation_not_found_for_signal', requestId: req.id }); return reply.code(201).send({ decision: r.decision }); });
    app.get('/v1/signals/:signalId/decisions', async (req, reply) => { const actor = await actorFor(req); if (!actor)
        return reply.code(401).send({ error: 'authentication_required', requestId: req.id }); if (!canReadDecisionsActions(actor))
        return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id }); const { signalId } = req.params; if (!signalId || !UUID.test(signalId))
        return reply.code(400).send({ error: 'invalid_signal_id', requestId: req.id }); const limit = parseQueryLimit(req.query.limit, 25); if (limit === null)
        return reply.code(400).send({ error: 'invalid_limit', requestId: req.id }); const rows = await opts.store.listDecisions(actor, signalId, limit); if (rows === null)
        return reply.code(404).send({ error: 'signal_not_found', requestId: req.id }); return reply.send({ decisions: rows }); });
    app.post('/v1/signals/:signalId/actions', async (req, reply) => { const actor = await actorFor(req); if (!actor)
        return reply.code(401).send({ error: 'authentication_required', requestId: req.id }); if (!canCreateResponseActions(actor))
        return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id }); const { signalId } = req.params; if (!signalId || !UUID.test(signalId))
        return reply.code(400).send({ error: 'invalid_signal_id', requestId: req.id }); const parsed = ResponseActionIntakeSchema.safeParse(req.body); if (!parsed.success)
        return reply.code(400).send({ error: 'invalid_response_action', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code })), requestId: req.id }); const r = await opts.store.createAction(actor, signalId, parsed.data); if (r.kind === 'signal_not_found')
        return reply.code(404).send({ error: 'signal_not_found', requestId: req.id }); if (r.kind === 'decision_not_found')
        return reply.code(404).send({ error: 'decision_not_found_for_signal', requestId: req.id }); if (r.kind === 'invalid_owner')
        return reply.code(400).send({ error: 'owner_not_active_member', requestId: req.id }); return reply.code(201).send({ action: r.action }); });
    app.get('/v1/signals/:signalId/actions', async (req, reply) => { const actor = await actorFor(req); if (!actor)
        return reply.code(401).send({ error: 'authentication_required', requestId: req.id }); if (!canReadDecisionsActions(actor))
        return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id }); const { signalId } = req.params; if (!signalId || !UUID.test(signalId))
        return reply.code(400).send({ error: 'invalid_signal_id', requestId: req.id }); const limit = parseQueryLimit(req.query.limit, 25); if (limit === null)
        return reply.code(400).send({ error: 'invalid_limit', requestId: req.id }); const rows = await opts.store.listActions(actor, signalId, limit); if (rows === null)
        return reply.code(404).send({ error: 'signal_not_found', requestId: req.id }); return reply.send({ actions: rows }); });
    app.patch('/v1/actions/:actionId', async (req, reply) => { const actor = await actorFor(req); if (!actor)
        return reply.code(401).send({ error: 'authentication_required', requestId: req.id }); if (!canReadDecisionsActions(actor) || !actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'responder', 'investigator'].includes(r)))
        return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id }); const { actionId } = req.params; if (!actionId || !UUID.test(actionId))
        return reply.code(400).send({ error: 'invalid_action_id', requestId: req.id }); const parsed = ResponseActionUpdateSchema.safeParse(req.body); if (!parsed.success)
        return reply.code(400).send({ error: 'invalid_response_action_update', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code })), requestId: req.id }); const r = await opts.store.updateAction(actor, actionId, parsed.data); if (r.kind === 'not_found')
        return reply.code(404).send({ error: 'action_not_found', requestId: req.id }); if (r.kind === 'forbidden')
        return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id }); if (r.kind === 'conflict')
        return reply.code(409).send({ error: 'action_version_conflict_or_terminal_state', requestId: req.id }); return reply.send({ action: r.action }); });
}
