import { z } from 'zod';
import { CountryCodeSchema, IndicatorCodeSchema, ProgrammeCodeSchema } from './interoperability.js';
export const ExchangeFormatSchema = z.enum(['dhis2_data_value_set', 'fhir_bundle', 'csv_aggregate']);
export const ExchangeEnvelopeSchema = z.object({
    schemaVersion: z.literal('1.0'),
    exchangeId: z.string().uuid(),
    provider: z.enum(['dhis2', 'fhir', 'csv', 'other']),
    format: ExchangeFormatSchema,
    direction: z.enum(['import', 'export']),
    countryCode: CountryCodeSchema,
    programmeCode: ProgrammeCodeSchema.optional(),
    indicatorCodes: z.array(IndicatorCodeSchema).min(1).max(500),
    mappingVersion: z.string().trim().min(1).max(80),
    administrativeUnitMappingVersion: z.string().trim().min(1).max(80).optional(),
    purpose: z.string().trim().min(3).max(500),
    generatedAt: z.string().datetime({ offset: true }),
    payloadDigest: z.string().regex(/^[a-f0-9]{64}$/),
    recordCount: z.number().int().nonnegative(),
    suppression: z.object({
        applied: z.boolean(),
        minimumCellSize: z.number().int().min(1).max(100000),
        suppressedRecordCount: z.number().int().nonnegative()
    }).strict(),
    sourceSystem: z.string().trim().min(1).max(160)
}).strict();
/**
 * Minimum-cell suppression is a privacy boundary, not a cosmetic formatting step.
 * Values below the configured threshold become null and are never serialized as zero.
 */
export function applyMinimumCellSuppression(records, minimumCellSize) {
    if (!Number.isInteger(minimumCellSize) || minimumCellSize < 1)
        throw new Error('invalid_minimum_cell_size');
    let suppressedRecordCount = 0;
    const output = records.map(record => {
        if (!Number.isInteger(record.cellCount) || record.cellCount < 0)
            throw new Error('invalid_cell_count');
        if (record.cellCount < minimumCellSize && record.value !== null) {
            suppressedRecordCount += 1;
            return { ...record, value: null };
        }
        return { ...record };
    });
    return { records: output, suppressedRecordCount };
}
export function canonicalAggregatePayload(records) {
    return JSON.stringify([...records]
        .map(r => ({ indicatorCode: r.indicatorCode, administrativeUnitCode: r.administrativeUnitCode, period: r.period, value: r.value, cellCount: r.cellCount }))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
