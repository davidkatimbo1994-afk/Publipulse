import { canReadAudit, decodeAuditCursor, encodeAuditCursor } from './audit-store.js';
import { parseQueryLimit } from './request-validation.js';
export async function registerAuditRoutes(app, options) {
    app.get('/v1/audit-events', async (request, reply) => {
        const actor = await options.resolveActor(request.headers.authorization, typeof request.headers['x-organization-id'] === 'string' ? request.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: request.id });
        if (!canReadAudit(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: request.id });
        const query = request.query;
        const limit = parseQueryLimit(query.limit);
        if (limit === null)
            return reply.code(400).send({ error: 'invalid_limit', requestId: request.id });
        const cursor = decodeAuditCursor(query.cursor);
        if (cursor === null)
            return reply.code(400).send({ error: 'invalid_cursor', requestId: request.id });
        const rows = await options.store.list(actor, limit + 1, cursor);
        const hasMore = rows.length > limit;
        const events = hasMore ? rows.slice(0, limit) : rows;
        const lastEvent = events.at(-1);
        return reply.send({ events, nextCursor: hasMore && lastEvent ? encodeAuditCursor(lastEvent) : null });
    });
}
