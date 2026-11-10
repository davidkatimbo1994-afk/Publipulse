import { z } from 'zod';
import { CountryCodeSchema, IndicatorCodeSchema, ProgrammeCodeSchema } from './interoperability.js';
export const InteroperabilityContractVersionSchema = z.literal('1.0');
export const ExchangeDirectionSchema = z.enum(['import', 'export']);
export const ExchangeModeSchema = z.enum(['metadata', 'aggregate_data']);
export const InteroperabilityProviderSchema = z.enum(['dhis2', 'fhir', 'csv', 'other']);
export const ExchangeJobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'rejected', 'cancelled']);
export const ExchangeRejectionCodeSchema = z.enum([
    'policy_missing', 'policy_inactive', 'indicator_not_allowed', 'cross_border_not_allowed',
    'idempotency_conflict', 'profile_missing', 'profile_not_verified', 'capability_missing', 'country_mismatch',
    'programme_mismatch', 'mapping_missing', 'contract_invalid', 'transport_disabled'
]);
export const InteroperabilityContractSchema = z.object({
    contractVersion: InteroperabilityContractVersionSchema,
    provider: InteroperabilityProviderSchema,
    direction: ExchangeDirectionSchema,
    mode: ExchangeModeSchema,
    countryCode: CountryCodeSchema,
    programmeCode: ProgrammeCodeSchema.optional(),
    indicatorCodes: z.array(IndicatorCodeSchema).min(1).max(500),
    integrationProfileId: z.string().uuid(),
    mappingVersion: z.string().trim().min(1).max(80),
    administrativeUnitMappingVersion: z.string().trim().min(1).max(80).optional(),
    requestedBy: z.string().uuid(),
    sourceSystem: z.string().trim().min(1).max(160),
    sourceRecordIds: z.array(z.string().trim().min(1).max(240)).max(1000).default([]),
    purpose: z.string().trim().min(3).max(500),
    crossBorder: z.boolean().default(false)
}).strict();
export const ExchangeReceiptSchema = z.object({
    exchangeId: z.string().uuid(),
    status: z.enum(['accepted', 'rejected', 'completed', 'failed']),
    provider: InteroperabilityProviderSchema,
    contractVersion: InteroperabilityContractVersionSchema,
    idempotencyKey: z.string().trim().min(8).max(200),
    externalReference: z.string().trim().max(240).optional(),
    receivedAt: z.string().datetime({ offset: true }),
    message: z.string().trim().max(500).optional()
}).strict();
export function normalizeIndicatorCodes(codes) {
    return [...new Set(codes)].sort();
}
export function stableContractFingerprint(contract) {
    const normalized = {
        ...contract,
        indicatorCodes: normalizeIndicatorCodes(contract.indicatorCodes),
        sourceRecordIds: [...contract.sourceRecordIds].sort()
    };
    return JSON.stringify(normalized);
}
