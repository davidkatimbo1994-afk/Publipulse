import { z } from 'zod';
import { publicHealthNarrative } from './data-boundary.js';
/** A reviewer's decision on one pending community submission. */
export const CommunityReviewSchema = z.discriminatedUnion('decision', [
    z.object({
        decision: z.literal('promote'),
        // Optional: when left out, the server writes a plain summary from the structured fields.
        summary: publicHealthNarrative(z.string().trim().min(10).max(1000)).optional(),
        category: z.enum(['unusual_illness', 'environmental_hazard', 'service_disruption', 'other']).optional(),
        precision: z.enum(['community', 'district']).optional()
    }).strict(),
    z.object({ decision: z.literal('merge'), signalId: z.string().uuid(), reason: z.string().trim().min(3).max(500).optional() }).strict(),
    z.object({ decision: z.literal('dismiss'), reason: z.string().trim().min(3).max(500) }).strict()
]);
export const DEFAULT_COMMUNITY_LIMITS = { senderPerHour: 3, senderPerDay: 10, organizationPerHour: 500, cooldownRejects: 3, cooldownHours: 24 };
