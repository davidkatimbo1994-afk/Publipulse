import { describe, expect, it } from 'vitest';
import { reconcileDhis2Metadata } from '../src/dhis2-metadata-reconciliation.js';
import type { Dhis2IndicatorMapping, Dhis2OrgUnitMapping } from '@publipulse/shared/dhis2-metadata';

const indicator: Dhis2IndicatorMapping = { countryCode: 'UG', publipulseIndicatorCode: 'MALARIA_CASES', dhis2DataElementUid: 'abcdefghijk', mappingVersion: '1', expectedValueType: 'INTEGER', expectedAggregationType: 'SUM', active: true };
const orgUnit: Dhis2OrgUnitMapping = { countryCode: 'UG', level: 2, localCode: 'UG-TEST-1', dhis2OrganisationUnitUid: '12345678901', mappingVersion: '1', active: true };
const snapshot = { provider: 'dhis2', instanceVersion: '2.40-test', indicators: [{ id: 'abcdefghijk', code: 'MALARIA_CASES', name: 'Malaria cases', valueType: 'INTEGER', aggregationType: 'SUM' }], organisationUnits: [{ id: '12345678901', code: 'UG-TEST-1', name: 'Test district', level: 2 }], observedAt: '2026-10-15T12:00:00+00:00' };

describe('DHIS2 metadata reconciliation', () => {
  it('aligns approved indicator and organisation-unit mappings', () => {
    expect(reconcileDhis2Metadata({ snapshot, indicatorMappings: [indicator], orgUnitMappings: [orgUnit] })).toMatchObject({ status: 'aligned', checkedIndicators: 1, checkedOrgUnits: 1, drift: [] });
  });
  it('detects indicator attribute drift', () => {
    const drifted = { ...snapshot, indicators: [{ ...snapshot.indicators[0], aggregationType: 'AVERAGE' }] };
    const result = reconcileDhis2Metadata({ snapshot: drifted, indicatorMappings: [indicator], orgUnitMappings: [orgUnit] });
    expect(result.status).toBe('drift_detected');
    expect(result.drift.some(d => d.kind === 'indicator_attribute_changed')).toBe(true);
  });
  it('detects missing organisation units', () => {
    const drifted = { ...snapshot, organisationUnits: [] };
    const result = reconcileDhis2Metadata({ snapshot: drifted, indicatorMappings: [indicator], orgUnitMappings: [orgUnit] });
    expect(result.status).toBe('drift_detected');
    expect(result.drift.some(d => d.kind === 'org_unit_missing')).toBe(true);
  });
  it('rejects malformed metadata snapshots', () => {
    const result = reconcileDhis2Metadata({ snapshot: { provider: 'dhis2' }, indicatorMappings: [], orgUnitMappings: [] });
    expect(result.status).toBe('invalid_snapshot');
  });
});
