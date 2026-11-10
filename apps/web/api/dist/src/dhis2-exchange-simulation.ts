import { createHash } from 'node:crypto';
import type { InteroperabilityContract } from '@publipulse/shared';
import type { Dhis2IndicatorMapping, Dhis2MetadataSnapshot, Dhis2OrgUnitMapping } from '@publipulse/shared/dhis2-metadata';
import { Dhis2MetadataSnapshotSchema, compareIndicatorMapping, compareOrgUnitMapping } from '@publipulse/shared/dhis2-metadata';
import { reconcileExchange } from '@publipulse/shared/interoperability-reconciliation';
import type { Dhis2Adapter } from './dhis2-adapter.js';
import { ControlledDhis2HttpClient } from './dhis2-test-harness.js';

export type Dhis2LocalAggregateRecord = {
  indicatorCode: string;
  localOrgUnitCode: string;
  period: string;
  value: number;
};

export type Dhis2MappedDataValue = {
  dataElement: string;
  orgUnit: string;
  period: string;
  value: number;
};

export type Dhis2ExchangeEvidence = {
  metadataStatus: 'aligned';
  metadataInstanceVersion: string;
  mappingVersion: string;
  dataValueCount: number;
  localTotal: number;
  externalTotal: number;
  reconciliationStatus: 'exact' | 'within_tolerance' | 'mismatch' | 'not_comparable';
  externalReference: string;
  transportVerified: true;
  idempotentReplayReference: string;
  duplicateSubmissionCount: number;
  payloadDigest: string;
};

export function mapAggregateRecords(
  records: readonly Dhis2LocalAggregateRecord[],
  indicatorMappings: readonly Dhis2IndicatorMapping[],
  orgUnitMappings: readonly Dhis2OrgUnitMapping[],
  countryCode: string,
  mappingVersion: string
): Dhis2MappedDataValue[] {
  const indicators = new Map(indicatorMappings.filter(m => m.active && m.countryCode === countryCode && m.mappingVersion === mappingVersion).map(m => [m.publipulseIndicatorCode, m]));
  const orgUnits = new Map(orgUnitMappings.filter(m => m.active && m.countryCode === countryCode && m.mappingVersion === mappingVersion).map(m => [m.localCode, m]));
  return records.map(record => {
    const indicator = indicators.get(record.indicatorCode);
    const orgUnit = orgUnits.get(record.localOrgUnitCode);
    if (!indicator) throw new Error(`dhis2_indicator_mapping_missing:${record.indicatorCode}`);
    if (!orgUnit) throw new Error(`dhis2_org_unit_mapping_missing:${record.localOrgUnitCode}`);
    return { dataElement: indicator.dhis2DataElementUid, orgUnit: orgUnit.dhis2OrganisationUnitUid, period: record.period, value: record.value };
  });
}

export function payloadDigest(payload: readonly Dhis2MappedDataValue[]): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function validateAlignedMetadata(
  snapshot: unknown,
  indicatorMappings: readonly Dhis2IndicatorMapping[],
  orgUnitMappings: readonly Dhis2OrgUnitMapping[]
): Dhis2MetadataSnapshot {
  const parsed = Dhis2MetadataSnapshotSchema.parse(snapshot);
  const drift = [
    ...indicatorMappings.flatMap(mapping => compareIndicatorMapping(mapping, parsed)),
    ...orgUnitMappings.flatMap(mapping => compareOrgUnitMapping(mapping, parsed))
  ];
  if (drift.length) throw new Error(`dhis2_metadata_drift:${drift.map(d => d.kind).join(',')}`);
  return parsed;
}

export async function runControlledDhis2EndToEnd(input: {
  adapter: Dhis2Adapter;
  harness: ControlledDhis2HttpClient;
  contract: InteroperabilityContract;
  metadata?: Dhis2MetadataSnapshot;
  indicatorMappings: readonly Dhis2IndicatorMapping[];
  orgUnitMappings: readonly Dhis2OrgUnitMapping[];
  records: readonly Dhis2LocalAggregateRecord[];
  tolerance?: number;
}): Promise<Dhis2ExchangeEvidence> {
  if (input.contract.provider !== 'dhis2' || input.contract.direction !== 'export' || input.contract.mode !== 'aggregate_data') {
    throw new Error('dhis2_end_to_end_contract_not_supported');
  }
  const metadata = validateAlignedMetadata(input.metadata ?? await input.adapter.fetchMetadata(input.contract), input.indicatorMappings, input.orgUnitMappings);
  const payload = mapAggregateRecords(input.records, input.indicatorMappings, input.orgUnitMappings, input.contract.countryCode, input.contract.mappingVersion);
  const digest = payloadDigest(payload);
  const localTotal = input.records.reduce((sum, record) => sum + record.value, 0);
  const idempotencyKey = `controlled:${input.contract.countryCode}:${input.contract.programmeCode ?? 'none'}:${input.contract.mappingVersion}:${digest}`;
  const first = await input.adapter.executeWithPayload(input.contract, payload, idempotencyKey);
  if (!first.externalReference) throw new Error('dhis2_end_to_end_missing_external_reference');
  const second = await input.adapter.executeWithPayload(input.contract, payload, idempotencyKey);
  if (!second.externalReference) throw new Error('dhis2_end_to_end_missing_replay_reference');
  if (first.externalReference !== second.externalReference) throw new Error('dhis2_end_to_end_idempotency_failed');
  const external = input.harness.lastSubmission;
  if (!external) throw new Error('dhis2_end_to_end_missing_submission_evidence');
  const reconciliation = reconcileExchange({
    localRecordCount: input.records.length,
    externalRecordCount: external.dataValueCount,
    localTotal,
    externalTotal: external.total,
    tolerance: input.tolerance ?? 0
  });
  return {
    metadataStatus: 'aligned',
    metadataInstanceVersion: metadata.instanceVersion,
    mappingVersion: input.contract.mappingVersion,
    dataValueCount: external.dataValueCount,
    localTotal,
    externalTotal: external.total,
    reconciliationStatus: reconciliation.status,
    externalReference: first.externalReference,
    transportVerified: true,
    idempotentReplayReference: second.externalReference,
    duplicateSubmissionCount: input.harness.dataValueSets.length - 1,
    payloadDigest: digest
  };
}
