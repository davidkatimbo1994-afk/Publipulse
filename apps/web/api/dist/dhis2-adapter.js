import { Dhis2MetadataSnapshotSchema } from '@publipulse/shared/dhis2-metadata';
/**
 * Contract-only DHIS2 adapter boundary. A real HTTP client and credential provider must be
 * injected by a controlled deployment. This class intentionally performs no network I/O by itself.
 */
export class Dhis2Adapter {
    http;
    credentials;
    provider = 'dhis2';
    constructor(http, credentials) {
        this.http = http;
        this.credentials = credentials;
    }
    async fetchMetadata(contract) {
        const auth = await this.credentials.resolve(contract.integrationProfileId);
        const snapshot = await this.http.get('/api/metadata', auth.authorizationHeader);
        return Dhis2MetadataSnapshotSchema.parse(snapshot);
    }
    async execute(contract) {
        // Contract metadata is attached by executeWithPayload; dataValues is an array (empty when no payload is supplied).
        return this.executeWithPayload(contract, []);
    }
    async executeWithPayload(contract, dataValues, idempotencyKey) {
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
