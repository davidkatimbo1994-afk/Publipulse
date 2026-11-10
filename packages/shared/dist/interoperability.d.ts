import { z } from 'zod';
export declare const CountryCodeSchema: z.ZodString;
export declare const ProgrammeCodeSchema: z.ZodString;
export declare const IndicatorCodeSchema: z.ZodString;
export declare const CountryConfigSchema: z.ZodObject<{
    countryCode: z.ZodString;
    name: z.ZodString;
    defaultLanguage: z.ZodString;
    timezone: z.ZodString;
    administrativeLevels: z.ZodArray<z.ZodObject<{
        level: z.ZodNumber;
        codeSystem: z.ZodString;
        label: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        level: number;
        codeSystem: string;
        label: string;
    }, {
        level: number;
        codeSystem: string;
        label: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    name: string;
    countryCode: string;
    defaultLanguage: string;
    timezone: string;
    administrativeLevels: {
        level: number;
        codeSystem: string;
        label: string;
    }[];
}, {
    name: string;
    countryCode: string;
    defaultLanguage: string;
    timezone: string;
    administrativeLevels: {
        level: number;
        codeSystem: string;
        label: string;
    }[];
}>;
export type CountryConfig = z.infer<typeof CountryConfigSchema>;
export declare const ProgrammeConfigSchema: z.ZodObject<{
    countryCode: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<["draft", "active", "suspended", "retired"]>;
    configuration: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strict", z.ZodTypeAny, {
    code: string;
    status: "active" | "draft" | "suspended" | "retired";
    name: string;
    countryCode: string;
    configuration: Record<string, unknown>;
}, {
    code: string;
    status: "active" | "draft" | "suspended" | "retired";
    name: string;
    countryCode: string;
    configuration?: Record<string, unknown> | undefined;
}>;
export type ProgrammeConfig = z.infer<typeof ProgrammeConfigSchema>;
export declare const IndicatorDefinitionSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    unit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    aggregation: z.ZodEnum<["count", "rate", "ratio", "proportion", "percentage", "index", "other"]>;
    numeratorDefinition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    denominatorDefinition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sourceStandard: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    standardVersion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    code: string;
    name: string;
    description: string;
    aggregation: "other" | "count" | "rate" | "ratio" | "proportion" | "percentage" | "index";
    unit?: string | null | undefined;
    numeratorDefinition?: string | null | undefined;
    denominatorDefinition?: string | null | undefined;
    sourceStandard?: string | null | undefined;
    standardVersion?: string | null | undefined;
}, {
    code: string;
    name: string;
    description: string;
    aggregation: "other" | "count" | "rate" | "ratio" | "proportion" | "percentage" | "index";
    unit?: string | null | undefined;
    numeratorDefinition?: string | null | undefined;
    denominatorDefinition?: string | null | undefined;
    sourceStandard?: string | null | undefined;
    standardVersion?: string | null | undefined;
}>;
export type IndicatorDefinition = z.infer<typeof IndicatorDefinitionSchema>;
export declare const DataSharingPolicySchema: z.ZodObject<{
    programmeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    classification: z.ZodEnum<["aggregate", "operational", "sensitive"]>;
    purpose: z.ZodString;
    destinationType: z.ZodEnum<["same_organization", "authorized_programme", "authorized_country_system", "external_system"]>;
    allowedIndicatorCodes: z.ZodArray<z.ZodString, "many">;
    minimumCellSize: z.ZodDefault<z.ZodNumber>;
    allowCrossBorder: z.ZodDefault<z.ZodBoolean>;
    active: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    active: boolean;
    classification: "operational" | "aggregate" | "sensitive";
    purpose: string;
    destinationType: "same_organization" | "authorized_programme" | "authorized_country_system" | "external_system";
    allowedIndicatorCodes: string[];
    minimumCellSize: number;
    allowCrossBorder: boolean;
    programmeId?: string | null | undefined;
}, {
    classification: "operational" | "aggregate" | "sensitive";
    purpose: string;
    destinationType: "same_organization" | "authorized_programme" | "authorized_country_system" | "external_system";
    allowedIndicatorCodes: string[];
    active?: boolean | undefined;
    programmeId?: string | null | undefined;
    minimumCellSize?: number | undefined;
    allowCrossBorder?: boolean | undefined;
}>;
export type DataSharingPolicy = z.infer<typeof DataSharingPolicySchema>;
export declare const IntegrationProfileSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    provider: z.ZodEnum<["dhis2", "csv", "fhir", "other"]>;
    name: z.ZodString;
    status: z.ZodEnum<["planned", "configured", "verification_pending", "verified", "disabled"]>;
    baseUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    capabilities: z.ZodArray<z.ZodEnum<["indicator_import", "aggregate_export", "metadata_sync", "org_unit_mapping"]>, "many">;
    notes: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    status: "planned" | "configured" | "verification_pending" | "verified" | "disabled";
    name: string;
    provider: "other" | "dhis2" | "csv" | "fhir";
    capabilities: ("indicator_import" | "aggregate_export" | "metadata_sync" | "org_unit_mapping")[];
    id?: string | undefined;
    baseUrl?: string | undefined;
    notes?: string | undefined;
}, {
    status: "planned" | "configured" | "verification_pending" | "verified" | "disabled";
    name: string;
    provider: "other" | "dhis2" | "csv" | "fhir";
    capabilities: ("indicator_import" | "aggregate_export" | "metadata_sync" | "org_unit_mapping")[];
    id?: string | undefined;
    baseUrl?: string | undefined;
    notes?: string | undefined;
}>;
export type IntegrationProfile = z.infer<typeof IntegrationProfileSchema>;
