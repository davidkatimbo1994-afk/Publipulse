/**
 * Deterministic, in-memory DHIS2-compatible test double.
 * It is deliberately not a network server and cannot contact an external host.
 */
export class ControlledDhis2HttpClient {
    dataValueSets = [];
    metadata = {
        provider: 'dhis2',
        instanceVersion: '2.40-test',
        indicators: [{ id: 'abcdefghijk', code: 'MALARIA_CASES', name: 'Malaria cases', valueType: 'INTEGER', aggregationType: 'SUM' }],
        organisationUnits: [{ id: '12345678901', code: 'UG-TEST-1', name: 'Test district', level: 2 }],
        observedAt: '2026-10-15T12:00:00+00:00'
    };
    metadataRequests = [];
    submissionsByIdempotency = new Map();
    lastSubmission = null;
    async get(path, authorizationHeader) {
        this.requireAuth(authorizationHeader);
        this.metadataRequests.push(path);
        if (path === '/api/metadata') {
            return this.metadata;
        }
        throw new Error('controlled_dhis2_unknown_get');
    }
    async post(path, body, authorizationHeader) {
        this.requireAuth(authorizationHeader);
        if (path !== '/api/dataValueSets')
            throw new Error('controlled_dhis2_unknown_post');
        const envelope = body;
        const dataValues = Array.isArray(envelope.dataValues) ? envelope.dataValues : [];
        const digest = envelope.idempotencyKey?.trim() || JSON.stringify(dataValues);
        const existing = this.submissionsByIdempotency.get(digest);
        const reference = existing ?? `DHIS2-TEST-${this.dataValueSets.length + 1}`;
        if (!existing)
            this.dataValueSets.push({ body, reference });
        const total = dataValues.reduce((sum, item) => sum + (typeof item.value === 'number' ? item.value : 0), 0);
        this.lastSubmission = { dataValueCount: dataValues.length, total, reference };
        this.submissionsByIdempotency.set(digest, reference);
        return { reference, body: { status: 'SUCCESS', reference } };
    }
    requireAuth(header) {
        if (!header.startsWith('Bearer test-'))
            throw new Error('controlled_dhis2_authentication_failed');
    }
}
export class InMemoryTestCredentialProvider {
    token;
    constructor(token = 'test-token') {
        this.token = token;
    }
    async resolve(_profileId) {
        return { authorizationHeader: `Bearer test-${this.token}` };
    }
}
/**
 * Executes only against the in-memory controlled harness. This helper is not wired into
 * production routes; it exists to prove the adapter contract before a real DHIS2 deployment.
 */
export async function runControlledDhis2Export(adapter, contract) {
    if (contract.provider !== 'dhis2')
        throw new Error('controlled_dhis2_provider_mismatch');
    const result = await adapter.execute(contract);
    if (!result.externalReference)
        throw new Error('controlled_dhis2_missing_reference');
    return { externalReference: result.externalReference, transportVerified: true, harness: 'controlled_dhis2' };
}
