import { z } from 'zod';
export declare const ExchangeFormatSchema: z.ZodEnum<["dhis2_data_value_set", "fhir_bundle", "csv_aggregate"]>;
export type ExchangeFormat = z.infer<typeof ExchangeFormatSchema>;
export declare const ExchangeEnvelopeSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0">;
    exchangeId: z.ZodString;
    provider: z.ZodEnum<["dhis2", "fhir", "csv", "other"]>;
    format: z.ZodEnum<["dhis2_data_value_set", "fhir_bundle", "csv_aggregate"]>;
    direction: z.ZodEnum<["import", "export"]>;
    countryCode: z.ZodString;
    programmeCode: z.ZodOptional<z.ZodString>;
    indicatorCodes: z.ZodArray<z.ZodString, "many">;
    mappingVersion: z.ZodString;
    administrativeUnitMappingVersion: z.ZodOptional<z.ZodString>;
    purpose: z.ZodString;
    generatedAt: z.ZodString;
    payloadDigest: z.ZodString;
    recordCount: z.ZodNumber;
    suppression: z.ZodObject<{
        applied: z.ZodBoolean;
        minimumCellSize: z.ZodNumber;
        suppressedRecordCount: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        minimumCellSize: number;
        applied: boolean;
        suppressedRecordCount: number;
    }, {
        minimumCellSize: number;
        applied: boolean;
        suppressedRecordCount: number;
    }>;
    sourceSystem: z.ZodString;
}, "strict", z.ZodTypeAny, {
    countryCode: string;
    purpose: string;
    provider: "other" | "dhis2" | "csv" | "fhir";
    mappingVersion: string;
    direction: "import" | "export";
    indicatorCodes: string[];
    sourceSystem: string;
    exchangeId: string;
    schemaVersion: "1.0";
    format: "dhis2_data_value_set" | "fhir_bundle" | "csv_aggregate";
    generatedAt: string;
    payloadDigest: string;
    recordCount: number;
    suppression: {
        minimumCellSize: number;
        applied: boolean;
        suppressedRecordCount: number;
    };
    programmeCode?: string | undefined;
    administrativeUnitMappingVersion?: string | undefined;
}, {
    countryCode: string;
    purpose: string;
    provider: "other" | "dhis2" | "csv" | "fhir";
    mappingVersion: string;
    direction: "import" | "export";
    indicatorCodes: string[];
    sourceSystem: string;
    exchangeId: string;
    schemaVersion: "1.0";
    format: "dhis2_data_value_set" | "fhir_bundle" | "csv_aggregate";
    generatedAt: string;
    payloadDigest: string;
    recordCount: number;
    suppression: {
        minimumCellSize: number;
        applied: boolean;
        suppressedRecordCount: number;
    };
    programmeCode?: string | undefined;
    administrativeUnitMappingVersion?: string | undefined;
}>;
export type ExchangeEnvelope = z.infer<typeof ExchangeEnvelopeSchema>;
export type AggregateExchangeRecord = {
    indicatorCode: string;
    administrativeUnitCode: string;
    period: string;
    value: number | null;
    cellCount: number;
};
/**
 * Minimum-cell suppression is a privacy boundary, not a cosmetic formatting step.
 * Values below the configured threshold become null and are never serialized as zero.
 */
export declare function applyMinimumCellSuppression(records: readonly AggregateExchangeRecord[], minimumCellSize: number): {
    records: AggregateExchangeRecord[];
    suppressedRecordCount: number;
};
export declare function canonicalAggregatePayload(records: readonly AggregateExchangeRecord[]): string;
