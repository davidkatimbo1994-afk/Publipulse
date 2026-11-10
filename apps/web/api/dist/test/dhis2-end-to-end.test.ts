import { describe, expect, it } from 'vitest';
import type { Dhis2IndicatorMapping, Dhis2OrgUnitMapping, InteroperabilityContract } from '@publipulse/shared';
import { Dhis2Adapter } from '../src/dhis2-adapter.js';
import { ControlledDhis2HttpClient, InMemoryTestCredentialProvider } from '../src/dhis2-test-harness.js';
import { runControlledDhis2EndToEnd } from '../src/dhis2-exchange-simulation.js';

const contract: InteroperabilityContract = {
  contractVersion: '1.0', provider: 'dhis2', direction: 'export', mode: 'aggregate_data', countryCode: 'UG',
  programmeCode: 'malaria', indicatorCodes: ['MALARIA_CASES'], integrationProfileId: '123e4567-e89b-42d3-a456-426614174000',
  mappingVersion: '1', requestedBy: '123e4567-e89b-42d3-a456-426614174001', sourceSystem: 'PubliPulse',
  sourceRecordIds: ['local-1', 'local-2'], purpose: 'Controlled end-to-end interoperability evidence', crossBorder: false
};

const indicatorMappings: Dhis2IndicatorMapping[] = [{ countryCode: 'UG', publipulseIndicatorCode: 'MALARIA_CASES', dhis2DataElementUid: 'abcdefghijk', mappingVersion: '1', expectedValueType: 'INTEGER', expectedAggregationType: 'SUM', active: true }];
const orgUnitMappings: Dhis2OrgUnitMapping[] = [{ countryCode: 'UG', level: 2, localCode: 'UG-TEST-1', dhis2OrganisationUnitUid: '12345678901', mappingVersion: '1', active: true }];
const metadata = { provider: 'dhis2' as const, instanceVersion: '2.40-test', indicators: [{ id: 'abcdefghijk', code: 'MALARIA_CASES', name: 'Malaria cases', valueType: 'INTEGER', aggregationType: 'SUM' }], organisationUnits: [{ id: '12345678901', code: 'UG-TEST-1', name: 'Test district', level: 2 }], observedAt: '2026-10-15T12:00:00+00:00' };

describe('DHIS2 controlled end-to-end exchange evidence', () => {
  it('proves metadata → mapping → payload → submission → receipt → reconciliation', async () => {
    const harness = new ControlledDhis2HttpClient();
    const adapter = new Dhis2Adapter(harness, new InMemoryTestCredentialProvider());
    const result = await runControlledDhis2EndToEnd({
      adapter, harness, contract, indicatorMappings, orgUnitMappings,
      records: [
        { indicatorCode: 'MALARIA_CASES', localOrgUnitCode: 'UG-TEST-1', period: '202610', value: 12 },
        { indicatorCode: 'MALARIA_CASES', localOrgUnitCode: 'UG-TEST-1', period: '202611', value: 8 }
      ]
    });
    expect(result).toMatchObject({ metadataStatus: 'aligned', reconciliationStatus: 'exact', externalReference: 'DHIS2-TEST-1', idempotentReplayReference: 'DHIS2-TEST-1', duplicateSubmissionCount: 0, dataValueCount: 2, localTotal: 20, externalTotal: 20, transportVerified: true });
    expect(result.payloadDigest).toHaveLength(64);
    expect(harness.dataValueSets).toHaveLength(1);
    expect(harness.metadataRequests).toEqual(['/api/metadata']);
  });

  it('fails closed when metadata has drift', async () => {
    const harness = new ControlledDhis2HttpClient();
    const adapter = new Dhis2Adapter(harness, new InMemoryTestCredentialProvider());
    await expect(runControlledDhis2EndToEnd({
      adapter, harness, contract,
      metadata: { ...metadata, indicators: [{ ...metadata.indicators[0], aggregationType: 'AVERAGE' }] },
      indicatorMappings, orgUnitMappings, records: [{ indicatorCode: 'MALARIA_CASES', localOrgUnitCode: 'UG-TEST-1', period: '202610', value: 1 }]
    })).rejects.toThrow('dhis2_metadata_drift');
    expect(harness.dataValueSets).toHaveLength(0);
  });

  it('fails closed when a local organisation unit is unmapped', async () => {
    const harness = new ControlledDhis2HttpClient();
    const adapter = new Dhis2Adapter(harness, new InMemoryTestCredentialProvider());
    await expect(runControlledDhis2EndToEnd({
      adapter, harness, contract, indicatorMappings, orgUnitMappings, records: [{ indicatorCode: 'MALARIA_CASES', localOrgUnitCode: 'UNKNOWN', period: '202610', value: 1 }]
    })).rejects.toThrow('dhis2_org_unit_mapping_missing:UNKNOWN');
    expect(harness.dataValueSets).toHaveLength(0);
  });
});
