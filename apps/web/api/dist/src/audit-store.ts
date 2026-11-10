import type { VerifiedActor } from './signal-store.js';

/** Deliberately excludes free-form metadata: audit reads must not become a health-data export path. */
export interface AuditEventSummary {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: 'success' | 'denied' | 'failure';
  occurredAt: string;
}
export interface AuditPage { events: AuditEventSummary[]; nextCursor: string | null }
export interface AuditStore { list(actor: VerifiedActor, limit: number, cursor?: { occurredAt: string; id: string }): Promise<AuditEventSummary[]> }
export function canReadAudit(actor: VerifiedActor): boolean {
  return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'auditor'].includes(role));
}
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;

export function encodeAuditCursor(event: Pick<AuditEventSummary, 'id' | 'occurredAt'>): string {
  return Buffer.from(JSON.stringify({ id: event.id, occurredAt: event.occurredAt }), 'utf8').toString('base64url');
}

/** Invalid cursors are rejected before they can reach PostgreSQL. */
export function decodeAuditCursor(value: unknown): { id: string; occurredAt: string } | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length < 1 || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const decoded = Buffer.from(value, 'base64url');
    // Require a canonical base64url representation to avoid ambiguous cursor encodings.
    if (decoded.toString('base64url') !== value) return null;
    const parsed: unknown = JSON.parse(decoded.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || !Object.hasOwn(record, 'id') || !Object.hasOwn(record, 'occurredAt')) return null;
    if (typeof record.id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(record.id)) return null;
    if (BigInt(record.id) > MAX_POSTGRES_BIGINT) return null;
    if (typeof record.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.occurredAt)) return null;
    const timestamp = Date.parse(record.occurredAt);
    if (!Number.isFinite(timestamp)) return null;
    const normalized = new Date(timestamp).toISOString();
    // Accept only timestamps that normalize without changing the represented instant.
    if (normalized !== record.occurredAt) return null;
    return { id: record.id, occurredAt: normalized };
  } catch { return null; }
}
