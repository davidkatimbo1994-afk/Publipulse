export function canReadAudit(actor) {
    return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'auditor'].includes(role));
}
const MAX_POSTGRES_BIGINT = 9223372036854775807n;
export function encodeAuditCursor(event) {
    return Buffer.from(JSON.stringify({ id: event.id, occurredAt: event.occurredAt }), 'utf8').toString('base64url');
}
/** Invalid cursors are rejected before they can reach PostgreSQL. */
export function decodeAuditCursor(value) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'string' || value.length < 1 || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value))
        return null;
    try {
        const decoded = Buffer.from(value, 'base64url');
        // Require a canonical base64url representation to avoid ambiguous cursor encodings.
        if (decoded.toString('base64url') !== value)
            return null;
        const parsed = JSON.parse(decoded.toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return null;
        const record = parsed;
        if (Object.keys(record).length !== 2 || !Object.hasOwn(record, 'id') || !Object.hasOwn(record, 'occurredAt'))
            return null;
        if (typeof record.id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(record.id))
            return null;
        if (BigInt(record.id) > MAX_POSTGRES_BIGINT)
            return null;
        if (typeof record.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.occurredAt))
            return null;
        const timestamp = Date.parse(record.occurredAt);
        if (!Number.isFinite(timestamp))
            return null;
        const normalized = new Date(timestamp).toISOString();
        // Accept only timestamps that normalize without changing the represented instant.
        if (normalized !== record.occurredAt)
            return null;
        return { id: record.id, occurredAt: normalized };
    }
    catch {
        return null;
    }
}
