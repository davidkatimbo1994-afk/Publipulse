import { z } from 'zod';
export declare const Dhis2UidSchema: z.ZodString;
export declare const Dhis2MetadataIndicatorSchema: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    valueType: z.ZodOptional<z.ZodString>;
    aggregationType: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    code: string;
    name: string;
    id: string;
    valueType?: string | undefined;
    aggregationType?: string | undefined;
}, {
    code: string;
    name: string;
    id: string;
    valueType?: string | undefined;
    aggregationType?: string | undefined;
}>;
export type Dhis2MetadataIndicator = z.infer<typeof Dhis2MetadataIndicatorSchema>;
export declare const Dhis2OrganisationUnitSchema: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    level: z.ZodNumber;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    name: string;
    level: number;
    id: string;
    code?: string | undefined;
    parentId?: string | null | undefined;
}, {
    name: string;
    level: number;
    id: string;
    code?: string | undefined;
    parentId?: string | null | undefined;
}>;
export type Dhis2OrganisationUnit = z.infer<typeof Dhis2OrganisationUnitSchema>;
export declare const Dhis2MetadataSnapshotSchema: z.ZodObject<{
    provider: z.ZodLiteral<"dhis2">;
    instanceVersion: z.ZodString;
    indicators: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        name: z.ZodString;
        valueType: z.ZodOptional<z.ZodString>;
        aggregationType: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        code: string;
        name: string;
        id: string;
        valueType?: string | undefined;
        aggregationType?: string | undefined;
    }, {
        code: string;
        name: string;
        id: string;
        valueType?: string | undefined;
        aggregationType?: string | undefined;
    }>, "many">;
    organisationUnits: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        code: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        level: z.ZodNumber;
        parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strict", z.ZodTypeAny, {
        name: string;
        level: number;
        id: string;
        code?: string | undefined;
        parentId?: string | null | undefined;
    }, {
        name: string;
        level: number;
        id: string;
        code?: string | undefined;
        parentId?: string | null | undefined;
    }>, "many">;
    observedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    provider: "dhis2";
    instanceVersion: string;
    indicators: {
        code: string;
        name: string;
        id: string;
        valueType?: string | undefined;
        aggregationType?: string | undefined;
    }[];
    organisationUnits: {
        name: string;
        level: number;
        id: string;
        code?: string | undefined;
        parentId?: string | null | undefined;
    }[];
    observedAt: string;
}, {
    provider: "dhis2";
    instanceVersion: string;
    indicators: {
        code: string;
        name: string;
        id: string;
        valueType?: string | undefined;
        aggregationType?: string | undefined;
    }[];
    organisationUnits: {
        name: string;
        level: number;
        id: string;
        code?: string | undefined;
        parentId?: string | null | undefined;
    }[];
    observedAt: string;
}>;
export type Dhis2MetadataSnapshot = z.infer<typeof Dhis2MetadataSnapshotSchema>;
export declare const Dhis2IndicatorMappingSchema: z.ZodObject<{
    countryCode: z.ZodString;
    publipulseIndicatorCode: z.ZodString;
    dhis2DataElementUid: z.ZodString;
    mappingVersion: z.ZodString;
    expectedValueType: z.ZodOptional<z.ZodString>;
    expectedAggregationType: z.ZodOptional<z.ZodString>;
    active: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    active: boolean;
    countryCode: string;
    publipulseIndicatorCode: string;
    dhis2DataElementUid: string;
    mappingVersion: string;
    expectedValueType?: string | undefined;
    expectedAggregationType?: string | undefined;
}, {
    countryCode: string;
    publipulseIndicatorCode: string;
    dhis2DataElementUid: string;
    mappingVersion: string;
    active?: boolean | undefined;
    expectedValueType?: string | undefined;
    expectedAggregationType?: string | undefined;
}>;
export type Dhis2IndicatorMapping = z.infer<typeof Dhis2IndicatorMappingSchema>;
export declare const Dhis2OrgUnitMappingSchema: z.ZodObject<{
    countryCode: z.ZodString;
    level: z.ZodNumber;
    localCode: z.ZodString;
    dhis2OrganisationUnitUid: z.ZodString;
    mappingVersion: z.ZodString;
    active: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    active: boolean;
    countryCode: string;
    level: number;
    mappingVersion: string;
    localCode: string;
    dhis2OrganisationUnitUid: string;
}, {
    countryCode: string;
    level: number;
    mappingVersion: string;
    localCode: string;
    dhis2OrganisationUnitUid: string;
    active?: boolean | undefined;
}>;
export type Dhis2OrgUnitMapping = z.infer<typeof Dhis2OrgUnitMappingSchema>;
export type MappingDrift = {
    kind: 'indicator_missing' | 'indicator_attribute_changed' | 'org_unit_missing' | 'org_unit_parent_changed' | 'org_unit_level_changed' | 'duplicate_mapping';
    key: string;
    detail: string;
};
export declare function compareIndicatorMapping(mapping: Dhis2IndicatorMapping, metadata: Dhis2MetadataSnapshot): MappingDrift[];
export declare function compareOrgUnitMapping(mapping: Dhis2OrgUnitMapping, metadata: Dhis2MetadataSnapshot): MappingDrift[];
export declare function findDuplicateMappings(mappings: readonly Dhis2IndicatorMapping[]): MappingDrift[];
