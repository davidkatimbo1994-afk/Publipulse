import { createHash } from 'node:crypto';
import { Dhis2MetadataSnapshotSchema, compareIndicatorMapping, compareOrgUnitMapping } from '@publipulse/shared/dhis2-metadata';
import { reconcileExchange } from '@publipulse/shared/interoperability-reconciliation';
export function mapAggregateRecords(records, indicatorMappings, orgUnitMappings, countryCode, mappingVersion) {
    const indicators = new Map(indicatorMappings.filter(m => m.active && m.countryCode === countryCode && m.mappingVersion === mappingVersion).map(m => [m.publipulseIndicatorCode, m]));
    const orgUnits = new Map(orgUnitMappings.filter(m => m.active && m.countryCode === countryCode && m.mappingVersion === mappingVersion).map(m => [m.localCode, m]));
    return records.map(record => {
        const indicator = indicators.get(record.indicatorCode);
        const orgUnit = orgUnits.get(record.localOrgUnitCode);
        if (!indicator)
            throw new Error(`dhis2_indicator_mapping_missing:${record.indicatorCode}`);
        if (!orgUnit)
            throw new Error(`dhis2_org_unit_mapping_missing:${record.localOrgUnitCode}`);
        return { dataElement: indicator.dhis2DataElementUid, orgUnit: orgUnit.dhis2OrganisationUnitUid, period: record.period, value: record.value };
    });
}
export function payloadDigest(payload) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
export function validateAlignedMetadata(snapshot, indicatorMappings, orgUnitMappings) {
    const parsed = Dhis2MetadataSnapshotSchema.parse(snapshot);
    const drift = [
        ...indicatorMappings.flatMap(mapping => compareIndicatorMapping(mapping, parsed)),
        ...orgUnitMappings.flatMap(mapping => compareOrgUnitMapping(mapping, parsed))
    ];
    if (drift.length)
        throw new Error(`dhis2_metadata_drift:${drift.map(d => d.kind).join(',')}`);
    return parsed;
}
export async function runControlledDhis2EndToEnd(input) {
    if (input.contract.provider !== 'dhis2' || input.contract.direction !== 'export' || input.contract.mode !== 'aggregate_data') {
        throw new Error('dhis2_end_to_end_contract_not_supported');
    }
    const metadata = validateAlignedMetadata(input.metadata ?? await input.adapter.fetchMetadata(input.contract), input.indicatorMappings, input.orgUnitMappings);
    const payload = mapAggregateRecords(input.records, input.indicatorMappings, input.orgUnitMappings, input.contract.countryCode, input.contract.mappingVersion);
    const digest = payloadDigest(payload);
    const localTotal = input.records.reduce((sum, record) => sum + record.value, 0);
    const idempotencyKey = `controlled:${input.contract.countryCode}:${input.contract.programmeCode ?? 'none'}:${input.contract.mappingVersion}:${digest}`;
    const first = await input.adapter.executeWithPayload(input.contract, payload, idempotencyKey);
    if (!first.externalReference)
        throw new Error('dhis2_end_to_end_missing_external_reference');
    const second = await input.adapter.executeWithPayload(input.contract, payload, idempotencyKey);
    if (!second.externalReference)
        throw new Error('dhis2_end_to_end_missing_replay_reference');
    if (first.externalReference !== second.externalReference)
        throw new Error('dhis2_end_to_end_idempotency_failed');
    const external = input.harness.lastSubmission;
    if (!external)
        throw new Error('dhis2_end_to_end_missing_submission_evidence');
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
