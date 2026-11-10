import { describe, expect, it } from 'vitest';
import type { InteroperabilityContract } from '@publipulse/shared';
import { Dhis2Adapter } from '../src/dhis2-adapter.js';
import { ControlledDhis2HttpClient, InMemoryTestCredentialProvider, runControlledDhis2Export } from '../src/dhis2-test-harness.js';

const contract: InteroperabilityContract = {
  contractVersion: '1.0', provider: 'dhis2', direction: 'export', mode: 'aggregate_data', countryCode: 'UG',
  programmeCode: 'malaria', indicatorCodes: ['MALARIA_CASES'], integrationProfileId: '123e4567-e89b-42d3-a456-426614174000',
  mappingVersion: '1', requestedBy: '123e4567-e89b-42d3-a456-426614174001', sourceSystem: 'PubliPulse',
  sourceRecordIds: ['local-1', 'local-2'], purpose: 'Controlled interoperability test', crossBorder: false
};

describe('controlled DHIS2 test harness', () => {
  it('proves the adapter can submit to a deterministic in-memory DHIS2 double', async () => {
    const http = new ControlledDhis2HttpClient();
    const adapter = new Dhis2Adapter(http, new InMemoryTestCredentialProvider());
    const result = await runControlledDhis2Export(adapter, contract);
    expect(result).toMatchObject({ transportVerified: true, harness: 'controlled_dhis2', externalReference: 'DHIS2-TEST-1' });
    expect(http.dataValueSets).toHaveLength(1);
    expect(http.dataValueSets[0].body).toMatchObject({ contractVersion: '1.0', countryCode: 'UG', programmeCode: 'malaria' });
  });

  it('rejects requests without the controlled bearer credential', async () => {
    const http = new ControlledDhis2HttpClient();
    await expect(http.get('/api/metadata', 'Bearer production-token')).rejects.toThrow('controlled_dhis2_authentication_failed');
  });

  it('never contacts a real network host because the harness has no network implementation', async () => {
    const http = new ControlledDhis2HttpClient();
    expect(http).toBeInstanceOf(ControlledDhis2HttpClient);
    expect(http.metadataRequests).toEqual([]);
  });
});
