import type { InteroperabilityContract } from '@publipulse/shared';
import { Dhis2MetadataSnapshotSchema } from '@publipulse/shared/dhis2-metadata';
import type { Dhis2MetadataSnapshot } from '@publipulse/shared/dhis2-metadata';
import type { InteroperabilityAdapter } from './interoperability-adapter.js';

/** Credential material is deliberately resolved at runtime and never persisted in PubliPulse. */
export interface ExternalCredentialProvider {
  resolve(profileId: string): Promise<{ authorizationHeader: string }>;
}

export interface Dhis2HttpClient {
  get(path: string, authorizationHeader: string): Promise<unknown>;
  post(path: string, body: unknown, authorizationHeader: string): Promise<{ reference?: string; body?: unknown }>;
}

/**
 * Contract-only DHIS2 adapter boundary. A real HTTP client and credential provider must be
 * injected by a controlled deployment. This class intentionally performs no network I/O by itself.
 */
export class Dhis2Adapter implements InteroperabilityAdapter {
  readonly provider = 'dhis2' as const;
  constructor(
    private readonly http: Dhis2HttpClient,
    private readonly credentials: ExternalCredentialProvider
  ) {}

  async fetchMetadata(contract: InteroperabilityContract): Promise<Dhis2MetadataSnapshot> {
    const auth = await this.credentials.resolve(contract.integrationProfileId);
    const snapshot = await this.http.get('/api/metadata', auth.authorizationHeader);
    return Dhis2MetadataSnapshotSchema.parse(snapshot);
  }

  async execute(contract: InteroperabilityContract): Promise<{ externalReference?: string }> {
    // Contract metadata is attached by executeWithPayload; dataValues is an array (empty when no payload is supplied).
    return this.executeWithPayload(contract, []);
  }

  async executeWithPayload(contract: InteroperabilityContract, dataValues: readonly unknown[], idempotencyKey?: string): Promise<{ externalReference?: string }> {
    const auth = await this.credentials.resolve(contract.integrationProfileId);
    if (contract.direction === 'export' && contract.mode === 'aggregate_data') {
      const response = await this.http.post('/api/dataValueSets', {
        contractVersion: contract.contractVersion,
        countryCode: contract.countryCode,
        programmeCode: contract.programmeCode,
        indicatorCodes: contract.indicatorCodes,
        dataValues,
        idempotencyKey
      }, auth.authorizationHeader);
      return response.reference ? { externalReference: response.reference } : {};
    }
    throw new Error('dhis2_operation_not_implemented');
  }
}
