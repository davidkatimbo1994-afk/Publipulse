import { z } from 'zod';
import { publicHealthNarrative } from './data-boundary.js';
export const UpstreamProviderSchema = z.enum(['dhis2', 'fhir', 'other']);
/** Provider-neutral event normalized before it can enter PubliPulse's outcome workflow. */
export const UpstreamEventSchema = z.object({
    integrationProfileId: z.string().uuid(),
    provider: UpstreamProviderSchema,
    externalEventId: z.string().trim().min(1).max(240),
    contractVersion: z.string().regex(/^\d+\.\d+$/).max(20),
    category: z.enum(['unusual_illness', 'environmental_hazard', 'service_disruption', 'other']),
    summary: publicHealthNarrative(z.string().trim().min(10).max(1000)),
    observedAt: z.string().datetime({ offset: true }),
    location: z.object({ administrativeAreaCode: z.string().trim().min(1).max(80), precision: z.enum(['community', 'facility', 'district']) }).strict(),
    sourceType: z.enum(['community_report', 'facility_report', 'field_observation', 'research', 'other'])
}).strict();
export const Dhis2UpstreamEventSchema = z.object({
    integrationProfileId: z.string().uuid(),
    provider: z.literal('dhis2'),
    externalEventId: z.string().trim().min(1).max(240),
    contractVersion: z.string().regex(/^\d+\.\d+$/).max(20),
    program: z.string().trim().min(1).max(240),
    orgUnit: z.string().trim().min(1).max(240),
    occurredAt: z.string().datetime({ offset: true }),
    category: z.enum(['unusual_illness', 'environmental_hazard', 'service_disruption', 'other']),
    summary: publicHealthNarrative(z.string().trim().min(10).max(1000)),
    sourceType: z.enum(['community_report', 'facility_report', 'field_observation', 'research', 'other'])
}).strict();
export function normalizeDhis2UpstreamEvent(input) {
    return {
        integrationProfileId: input.integrationProfileId,
        provider: 'dhis2',
        externalEventId: input.externalEventId,
        contractVersion: input.contractVersion,
        category: input.category,
        summary: input.summary,
        observedAt: input.occurredAt,
        location: { administrativeAreaCode: input.orgUnit, precision: 'district' },
        sourceType: input.sourceType
    };
}
