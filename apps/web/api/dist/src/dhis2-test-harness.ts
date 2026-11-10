import type { InteroperabilityContract } from '@publipulse/shared';
import type { Dhis2HttpClient, ExternalCredentialProvider } from './dhis2-adapter.js';

/**
 * Deterministic, in-memory DHIS2-compatible test double.
 * It is deliberately not a network server and cannot contact an external host.
 */
export class ControlledDhis2HttpClient implements Dhis2HttpClient {
  readonly dataValueSets: Array<{ body: unknown; reference: string }> = [];
  readonly metadata: unknown = {
    provider: 'dhis2',
    instanceVersion: '2.40-test',
    indicators: [{ id: 'abcdefghijk', code: 'MALARIA_CASES', name: 'Malaria cases', valueType: 'INTEGER', aggregationType: 'SUM' }],
    organisationUnits: [{ id: '12345678901', code: 'UG-TEST-1', name: 'Test district', level: 2 }],
    observedAt: '2026-10-15T12:00:00+00:00'
  };
  readonly metadataRequests: string[] = [];
  readonly submissionsByIdempotency: Map<string, string> = new Map();
  lastSubmission: { dataValueCount: number; total: number; reference: string } | null = null;

  async get(path: string, authorizationHeader: string): Promise<unknown> {
    this.requireAuth(authorizationHeader);
    this.metadataRequests.push(path);
    if (path === '/api/metadata') {
      return this.metadata;
    }
    throw new Error('controlled_dhis2_unknown_get');
  }

  async post(path: string, body: unknown, authorizationHeader: string): Promise<{ reference?: string; body?: unknown }> {
    this.requireAuth(authorizationHeader);
    if (path !== '/api/dataValueSets') throw new Error('controlled_dhis2_unknown_post');
    const envelope = body as { dataValues?: Array<{ value?: number }>; idempotencyKey?: string };
    const dataValues = Array.isArray(envelope.dataValues) ? envelope.dataValues : [];
    const digest = envelope.idempotencyKey?.trim() || JSON.stringify(dataValues);
    const existing = this.submissionsByIdempotency.get(digest);
    const reference = existing ?? `DHIS2-TEST-${this.dataValueSets.length + 1}`;
    if (!existing) this.dataValueSets.push({ body, reference });
    const total = dataValues.reduce((sum, item) => sum + (typeof item.value === 'number' ? item.value : 0), 0);
    this.lastSubmission = { dataValueCount: dataValues.length, total, reference };
    this.submissionsByIdempotency.set(digest, reference);
    return { reference, body: { status: 'SUCCESS', reference } };
  }

  private requireAuth(header: string): void {
    if (!header.startsWith('Bearer test-')) throw new Error('controlled_dhis2_authentication_failed');
  }
}

export class InMemoryTestCredentialProvider implements ExternalCredentialProvider {
  constructor(private readonly token = 'test-token') {}

  async resolve(_profileId: string): Promise<{ authorizationHeader: string }> {
    return { authorizationHeader: `Bearer test-${this.token}` };
  }
}

export type ControlledDhis2ExchangeResult = {
  externalReference: string;
  transportVerified: true;
  harness: 'controlled_dhis2';
};

/**
 * Executes only against the in-memory controlled harness. This helper is not wired into
 * production routes; it exists to prove the adapter contract before a real DHIS2 deployment.
 */
export async function runControlledDhis2Export(
  adapter: { execute(contract: InteroperabilityContract): Promise<{ externalReference?: string }> },
  contract: InteroperabilityContract
): Promise<ControlledDhis2ExchangeResult> {
  if (contract.provider !== 'dhis2') throw new Error('controlled_dhis2_provider_mismatch');
  const result = await adapter.execute(contract);
  if (!result.externalReference) throw new Error('controlled_dhis2_missing_reference');
  return { externalReference: result.externalReference, transportVerified: true, harness: 'controlled_dhis2' };
}
