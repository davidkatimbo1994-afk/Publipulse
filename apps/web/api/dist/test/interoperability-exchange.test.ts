import { describe, expect, it } from 'vitest';
import { validateExchangeContract } from '../src/interoperability-exchange.js';
import type { DataSharingPolicy, IntegrationProfile, InteroperabilityContract } from '@publipulse/shared';

const contract: InteroperabilityContract = {
  contractVersion: '1.0', provider: 'dhis2', direction: 'export', mode: 'aggregate_data', countryCode: 'UG',
  programmeCode: 'malaria', indicatorCodes: ['MALARIA_CASES'], integrationProfileId: '123e4567-e89b-42d3-a456-426614174000',
  mappingVersion: '1', requestedBy: '123e4567-e89b-42d3-a456-426614174001', sourceSystem: 'PubliPulse',
  sourceRecordIds: [], purpose: 'Routine programme reporting', crossBorder: false
};
const profile: IntegrationProfile = { id: contract.integrationProfileId, provider: 'dhis2', name: 'Controlled DHIS2 test', status: 'verified', capabilities: ['aggregate_export'] };
const policy: DataSharingPolicy = { programmeId: '123e4567-e89b-42d3-a456-426614174002', classification: 'aggregate', purpose: 'Routine programme reporting', destinationType: 'authorized_country_system', allowedIndicatorCodes: ['MALARIA_CASES'], minimumCellSize: 5, allowCrossBorder: false, active: true };

describe('interoperability exchange boundary', () => {
  it('allows a contract only when the verified profile, capability, policy and mapping are present', () => {
    expect(validateExchangeContract({ contract, profile, policies: [policy], mappedIndicatorCodes: ['MALARIA_CASES'] }).allowed).toBe(true);
  });
  it('fails closed when the profile is not verified', () => {
    expect(validateExchangeContract({ contract, profile: { ...profile, status: 'verification_pending' }, policies: [policy], mappedIndicatorCodes: ['MALARIA_CASES'] })).toMatchObject({ allowed: false, code: 'profile_not_verified' });
  });
  it('fails closed when an indicator is outside the policy', () => {
    expect(validateExchangeContract({ contract: { ...contract, indicatorCodes: ['OTHER'] }, profile, policies: [policy], mappedIndicatorCodes: ['OTHER'] })).toMatchObject({ allowed: false, code: 'indicator_not_allowed' });
  });
  it('fails closed for cross-border exchange unless policy permits it', () => {
    expect(validateExchangeContract({ contract: { ...contract, crossBorder: true }, profile, policies: [policy], mappedIndicatorCodes: ['MALARIA_CASES'] })).toMatchObject({ allowed: false, code: 'cross_border_not_allowed' });
  });
  it('fails closed when the required provider capability is absent', () => {
    expect(validateExchangeContract({ contract, profile: { ...profile, capabilities: ['metadata_sync'] }, policies: [policy], mappedIndicatorCodes: ['MALARIA_CASES'] })).toMatchObject({ allowed: false, code: 'capability_missing' });
  });
});
