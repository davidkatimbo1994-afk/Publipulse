import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { CreateSignalResult, SignalStatus, SignalStore, StoredSignal, TransitionSignalResult, VerifiedActor } from '../src/signal-store.js';
import type { SignalIntake, EvidenceIntake } from '@publipulse/shared';
import type { EvidenceStore, StoredEvidence, CreateEvidenceResult } from '../src/evidence-store.js';

const actor: VerifiedActor = { userId: 'user-1', organizationId: 'org-1', roles: ['reviewer'] };
const signalInput = () => ({
  clientSubmissionId: randomUUID(),
  category: 'environmental_hazard' as const,
  summary: 'Standing water observed near a community water point.',
  observedAt: '2026-10-11T08:30:00Z',
  location: { administrativeAreaCode: 'UG-C', precision: 'community' as const },
  sourceType: 'field_observation' as const
});

class TestSignalStore implements SignalStore {
  private rows: StoredSignal[] = [];
  async createIdempotent(who: VerifiedActor, input: SignalIntake): Promise<CreateSignalResult> {
    const prior = this.rows.find((row) => row.organizationId === who.organizationId && row.submittedBy === who.userId && row.clientSubmissionId === input.clientSubmissionId);
    if (prior) {
      const { id: _id, organizationId: _org, submittedBy: _by, status: _status, version: _version, createdAt: _created, ...priorInput } = prior;
      return JSON.stringify(priorInput) === JSON.stringify(input) ? { kind: 'replayed', signal: prior } : { kind: 'conflict' };
    }
    const row: StoredSignal = { ...input, id: randomUUID(), organizationId: who.organizationId, submittedBy: who.userId, status: 'submitted', version: 1, createdAt: new Date().toISOString() };
    this.rows.push(row);
    return { kind: 'created', signal: row };
  }
  async listForOrganization(organizationId: string, limit: number): Promise<StoredSignal[]> {
    return this.rows.filter((row) => row.organizationId === organizationId).slice(0, limit);
  }
  async transitionStatus(who: VerifiedActor, signalId: string, expectedVersion: number, nextStatus: SignalStatus): Promise<TransitionSignalResult> {
    const row = this.rows.find((candidate) => candidate.organizationId === who.organizationId && candidate.id === signalId);
    if (!row) return { kind: 'not_found' };
    if (row.version !== expectedVersion) return { kind: 'conflict' };
    const transitions: Record<SignalStatus, readonly SignalStatus[]> = {
      submitted: ['under_review', 'dismissed'], under_review: ['investigating', 'verified', 'dismissed'],
      investigating: ['under_review', 'verified', 'dismissed'], verified: ['closed'], dismissed: ['closed'], closed: []
    };
    if (!transitions[row.status].includes(nextStatus)) return { kind: 'invalid_transition', currentStatus: row.status };
    row.status = nextStatus;
    row.version += 1;
    return { kind: 'updated', signal: row };
  }
}

class TestEvidenceStore implements EvidenceStore {
  private rows: StoredEvidence[] = [];
  async create(who: VerifiedActor, signalId: string, input: EvidenceIntake): Promise<CreateEvidenceResult> {
    const evidence: StoredEvidence = { ...input, id: randomUUID(), organizationId: who.organizationId, signalId, submittedBy: who.userId, status: 'unreviewed', createdAt: new Date().toISOString() };
    this.rows.push(evidence);
    return { kind: 'created', evidence };
  }
  async list(who: VerifiedActor, signalId: string, limit: number): Promise<StoredEvidence[] | null> {
    const found = this.rows.some((row) => row.organizationId === who.organizationId && row.signalId === signalId);
    if (!found) return null;
    return this.rows.filter((row) => row.organizationId === who.organizationId && row.signalId === signalId).slice(0, limit);
  }
}

describe('API safety baseline', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => { if (app) await app.close(); app = undefined; });

  it('reports liveness without claiming readiness', async () => {
    app = await buildApp({ environment: 'test' });
    const live = await app.inject({ method: 'GET', url: '/health/live' });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: 'ok' });
    const ready = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(ready.statusCode).toBe(503);
    expect(ready.json().status).toBe('not_ready');
  });

  it('requires an explicit HTTPS web origin in production', async () => {
    await expect(buildApp({ environment: 'production' })).rejects.toThrow('WEB_ORIGIN must be explicitly configured');
    await expect(buildApp({ environment: 'production', allowedOrigin: 'http://example.org' })).rejects.toThrow('production origins must use HTTPS');
  });

  it('rejects an unapproved browser origin', async () => {
    app = await buildApp({ environment: 'test', allowedOrigin: 'http://localhost:5173' });
    const response = await app.inject({ method: 'GET', url: '/health/live', headers: { origin: 'https://untrusted.example' } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('origin_not_allowed');
  });

  it('accepts each origin in a comma-separated WEB_ORIGIN list and echoes only the requesting one', async () => {
    app = await buildApp({ environment: 'test', allowedOrigin: 'http://localhost:5173,http://localhost:5174' });
    const field = await app.inject({ method: 'GET', url: '/health/live', headers: { origin: 'http://localhost:5174' } });
    expect(field.statusCode).toBe(200);
    expect(field.headers['access-control-allow-origin']).toBe('http://localhost:5174');
    const web = await app.inject({ method: 'GET', url: '/health/live', headers: { origin: 'http://localhost:5173' } });
    expect(web.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await app.inject({ method: 'GET', url: '/health/live', headers: { origin: 'https://untrusted.example' } });
    expect(other.statusCode).toBe(403);
  });

  it('allows the outcome replay header in browser preflight', async () => {
    app = await buildApp({ environment: 'test', allowedOrigin: 'http://localhost:5173' });
    const response = await app.inject({ method: 'OPTIONS', url: '/v1/signals/00000000-0000-4000-8000-000000000000/outcomes', headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization,content-type,x-organization-id,x-client-mutation-id'
    } });
    expect(response.statusCode).toBe(204);
    expect(String(response.headers['access-control-allow-headers'])).toContain('x-client-mutation-id');
  });

  it('permits the explicit tenant selector header in approved browser preflight', async () => {
    app = await buildApp({ environment: 'test', allowedOrigin: 'http://localhost:5173' });
    const response = await app.inject({ method: 'OPTIONS', url: '/v1/signals', headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization,content-type,x-organization-id'
    } });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-headers']).toContain('x-organization-id');
  });

  it('does not expose internal details for unknown routes', async () => {
    app = await buildApp({ environment: 'test' });
    const response = await app.inject({ method: 'GET', url: '/not-a-route' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('not_found');
    expect(response.json().requestId).toBeTruthy();
  });

  it('fails closed when signal persistence and identity adapters are not configured', async () => {
    app = await buildApp({ environment: 'test' });
    const response = await app.inject({ method: 'POST', url: '/v1/signals', payload: signalInput() });
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toBe('signal_service_not_configured');
  });

  it('returns service-specific fail-closed errors for unconfigured workflow stages', async () => {
    app = await buildApp({ environment: 'test' });
    const investigation = await app.inject({ method: 'GET', url: '/v1/signals/123e4567-e89b-42d3-a456-426614174000/investigations' });
    const decisions = await app.inject({ method: 'GET', url: '/v1/signals/123e4567-e89b-42d3-a456-426614174000/decisions' });
    const actions = await app.inject({ method: 'GET', url: '/v1/signals/123e4567-e89b-42d3-a456-426614174000/actions' });
    const actionUpdate = await app.inject({ method: 'PATCH', url: '/v1/actions/123e4567-e89b-42d3-a456-426614174000', payload: {} });
    expect(investigation.statusCode).toBe(503);
    expect(investigation.json().error).toBe('investigation_service_not_configured');
    for (const response of [decisions, actions, actionUpdate]) {
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe('decision_action_service_not_configured');
    }
  });

  it('requires a verified actor before accepting a signal', async () => {
    app = await buildApp({ environment: 'test', resolveActor: async () => null, signalStore: new TestSignalStore() });
    const response = await app.inject({ method: 'POST', url: '/v1/signals', payload: signalInput() });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('authentication_required');
  });

  it('creates a signal and safely handles identical retries', async () => {
    const store = new TestSignalStore();
    app = await buildApp({ environment: 'test', resolveActor: async () => actor, signalStore: store });
    const payload = signalInput();
    const first = await app.inject({ method: 'POST', url: '/v1/signals', payload });
    const retry = await app.inject({ method: 'POST', url: '/v1/signals', payload });
    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(200);
    expect(retry.json().replayed).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/v1/signals', headers: { authorization: 'Bearer test' } })).statusCode).toBe(200);
  });

  it('keeps signal listings scoped to the verified organization', async () => {
    const store = new TestSignalStore();
    const otherActor: VerifiedActor = { userId: 'user-2', organizationId: 'org-2', roles: ['reviewer'] };
    const resolver = async (header: string | undefined) => header === 'Bearer org-1' ? actor : header === 'Bearer org-2' ? otherActor : null;
    app = await buildApp({ environment: 'test', resolveActor: resolver, signalStore: store });
    const orgOne = await app.inject({ method: 'POST', url: '/v1/signals', headers: { authorization: 'Bearer org-1' }, payload: signalInput() });
    const orgTwo = await app.inject({ method: 'POST', url: '/v1/signals', headers: { authorization: 'Bearer org-2' }, payload: signalInput() });
    expect(orgOne.statusCode).toBe(201);
    expect(orgTwo.statusCode).toBe(201);
    const listed = await app.inject({ method: 'GET', url: '/v1/signals', headers: { authorization: 'Bearer org-1' } });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().signals).toHaveLength(1);
    expect(listed.json().signals[0].organizationId).toBe('org-1');
  });

  it('rejects reuse of an idempotency identifier with changed content', async () => {
    const store = new TestSignalStore();
    app = await buildApp({ environment: 'test', resolveActor: async () => actor, signalStore: store });
    const payload = signalInput();
    await app.inject({ method: 'POST', url: '/v1/signals', payload });
    const conflict = await app.inject({ method: 'POST', url: '/v1/signals', payload: { ...payload, summary: 'A different but valid signal summary for this location.' } });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error).toBe('idempotency_conflict');
  });

  it('rejects invalid input and users without submission permission', async () => {
    app = await buildApp({ environment: 'test', resolveActor: async () => ({ ...actor, roles: ['read_only'] }), signalStore: new TestSignalStore() });
    const forbidden = await app.inject({ method: 'POST', url: '/v1/signals', payload: signalInput() });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
    app = await buildApp({ environment: 'test', resolveActor: async () => actor, signalStore: new TestSignalStore() });
    const invalid = await app.inject({ method: 'POST', url: '/v1/signals', payload: { ...signalInput(), patientName: 'Must not be accepted' } });
    expect(invalid.statusCode).toBe(400);
  });
});


describe('signal status lifecycle', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => { if (app) await app.close(); app = undefined; });

  it('allows a reviewer to move a signal into review with optimistic versioning', async () => {
    const store = new TestSignalStore();
    app = await buildApp({ environment: 'test', resolveActor: async () => actor, signalStore: store });
    const created = await app.inject({ method: 'POST', url: '/v1/signals', payload: signalInput() });
    const signal = created.json().signal as StoredSignal;
    const transitioned = await app.inject({ method: 'PATCH', url: `/v1/signals/${signal.id}/status`, payload: { status: 'under_review', expectedVersion: 1 } });
    expect(transitioned.statusCode).toBe(200);
    expect(transitioned.json().signal.status).toBe('under_review');
    expect(transitioned.json().signal.version).toBe(2);
    const stale = await app.inject({ method: 'PATCH', url: `/v1/signals/${signal.id}/status`, payload: { status: 'investigating', expectedVersion: 1 } });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error).toBe('signal_version_conflict');
  });

  it('does not let a read-only user change signal status', async () => {
    const store = new TestSignalStore();
    app = await buildApp({ environment: 'test', resolveActor: async () => actor, signalStore: store });
    const created = await app.inject({ method: 'POST', url: '/v1/signals', payload: signalInput() });
    const signal = created.json().signal as StoredSignal;
    await app.close();
    app = await buildApp({ environment: 'test', resolveActor: async () => ({ ...actor, roles: ['read_only'] }), signalStore: store });
    const response = await app.inject({ method: 'PATCH', url: `/v1/signals/${signal.id}/status`, payload: { status: 'under_review', expectedVersion: 1 } });
    expect(response.statusCode).toBe(403);
  });
});


describe('evidence provenance API', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => { if (app) await app.close(); app = undefined; });
  it('stores metadata with source provenance and returns it only within the actor tenant', async () => {
    const signalStore = new TestSignalStore();
    const evidenceStore = new TestEvidenceStore();
    app = await buildApp({ environment: 'test', resolveActor: async () => actor, signalStore, evidenceStore });
    const created = await app.inject({ method: 'POST', url: '/v1/signals/123e4567-e89b-42d3-a456-426614174000/evidence', payload: {
      evidenceType: 'official_report', description: 'District-level weekly aggregate report reviewed.', sourceLabel: 'District weekly bulletin', sourceUri: 'https://health.example.org/bulletin/42', observedAt: '2026-10-10T09:00:00Z'
    } });
    expect(created.statusCode).toBe(201);
    expect(created.json().evidence.status).toBe('unreviewed');
    const listed = await app.inject({ method: 'GET', url: '/v1/signals/123e4567-e89b-42d3-a456-426614174000/evidence' });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().evidence).toHaveLength(1);
  });
  it('rejects non-HTTPS provenance URLs and read-only evidence creation', async () => {
    app = await buildApp({ environment: 'test', resolveActor: async () => actor, signalStore: new TestSignalStore(), evidenceStore: new TestEvidenceStore() });
    const invalid = await app.inject({ method: 'POST', url: '/v1/signals/123e4567-e89b-42d3-a456-426614174000/evidence', payload: {
      evidenceType: 'document_reference', description: 'Reference to supporting document.', sourceLabel: 'Example', sourceUri: 'http://example.org/report'
    } });
    expect(invalid.statusCode).toBe(400);
    await app.close();
    app = await buildApp({ environment: 'test', resolveActor: async () => ({ ...actor, roles: ['read_only'] }), signalStore: new TestSignalStore(), evidenceStore: new TestEvidenceStore() });
    const denied = await app.inject({ method: 'POST', url: '/v1/signals/123e4567-e89b-42d3-a456-426614174000/evidence', payload: {
      evidenceType: 'field_note', description: 'Field observation notes reviewed.', sourceLabel: 'Field team'
    } });
    expect(denied.statusCode).toBe(403);
  });
});
