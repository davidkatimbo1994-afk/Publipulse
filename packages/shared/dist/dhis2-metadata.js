import { z } from 'zod';
import { CountryCodeSchema, IndicatorCodeSchema } from './interoperability.js';
export const Dhis2UidSchema = z.string().regex(/^[A-Za-z0-9]{11}$/);
export const Dhis2MetadataIndicatorSchema = z.object({
    id: Dhis2UidSchema,
    code: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(240),
    valueType: z.string().trim().min(1).max(80).optional(),
    aggregationType: z.string().trim().min(1).max(80).optional()
}).strict();
export const Dhis2OrganisationUnitSchema = z.object({
    id: Dhis2UidSchema,
    code: z.string().trim().min(1).max(120).optional(),
    name: z.string().trim().min(1).max(240),
    level: z.number().int().min(1).max(10),
    parentId: Dhis2UidSchema.nullable().optional()
}).strict();
export const Dhis2MetadataSnapshotSchema = z.object({
    provider: z.literal('dhis2'),
    instanceVersion: z.string().trim().min(1).max(80),
    indicators: z.array(Dhis2MetadataIndicatorSchema).max(10000),
    organisationUnits: z.array(Dhis2OrganisationUnitSchema).max(100000),
    observedAt: z.string().datetime({ offset: true })
}).strict();
export const Dhis2IndicatorMappingSchema = z.object({
    countryCode: CountryCodeSchema,
    publipulseIndicatorCode: IndicatorCodeSchema,
    dhis2DataElementUid: Dhis2UidSchema,
    mappingVersion: z.string().trim().min(1).max(80),
    expectedValueType: z.string().trim().min(1).max(80).optional(),
    expectedAggregationType: z.string().trim().min(1).max(80).optional(),
    active: z.boolean().default(true)
}).strict();
export const Dhis2OrgUnitMappingSchema = z.object({
    countryCode: CountryCodeSchema,
    level: z.number().int().min(1).max(10),
    localCode: z.string().trim().min(1).max(120),
    dhis2OrganisationUnitUid: Dhis2UidSchema,
    mappingVersion: z.string().trim().min(1).max(80),
    active: z.boolean().default(true)
}).strict();
export function compareIndicatorMapping(mapping, metadata) {
    const target = metadata.indicators.find(i => i.id === mapping.dhis2DataElementUid);
    if (!target)
        return [{ kind: 'indicator_missing', key: mapping.publipulseIndicatorCode, detail: `DHIS2 data element ${mapping.dhis2DataElementUid} is missing from the metadata snapshot.` }];
    const drift = [];
    if (mapping.expectedValueType && target.valueType && mapping.expectedValueType !== target.valueType) {
        drift.push({ kind: 'indicator_attribute_changed', key: mapping.publipulseIndicatorCode, detail: `Expected value type ${mapping.expectedValueType}, observed ${target.valueType}.` });
    }
    if (mapping.expectedAggregationType && target.aggregationType && mapping.expectedAggregationType !== target.aggregationType) {
        drift.push({ kind: 'indicator_attribute_changed', key: mapping.publipulseIndicatorCode, detail: `Expected aggregation type ${mapping.expectedAggregationType}, observed ${target.aggregationType}.` });
    }
    return drift;
}
export function compareOrgUnitMapping(mapping, metadata) {
    const target = metadata.organisationUnits.find(i => i.id === mapping.dhis2OrganisationUnitUid);
    if (!target)
        return [{ kind: 'org_unit_missing', key: mapping.localCode, detail: `DHIS2 organisation unit ${mapping.dhis2OrganisationUnitUid} is missing from the metadata snapshot.` }];
    const drift = [];
    if (target.level !== mapping.level)
        drift.push({ kind: 'org_unit_level_changed', key: mapping.localCode, detail: `Expected level ${mapping.level}, observed ${target.level}.` });
    return drift;
}
export function findDuplicateMappings(mappings) {
    const seen = new Set();
    const drift = [];
    for (const mapping of mappings) {
        const key = `${mapping.countryCode}:${mapping.publipulseIndicatorCode}:${mapping.mappingVersion}`;
        if (seen.has(key))
            drift.push({ kind: 'duplicate_mapping', key, detail: 'More than one active mapping claims the same country, indicator and mapping version.' });
        seen.add(key);
    }
    return drift;
}
