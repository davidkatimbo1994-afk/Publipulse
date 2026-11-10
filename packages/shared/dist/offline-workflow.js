import { z } from 'zod';
export const OfflineActionUpdateSchema = z.object({
    kind: z.literal('action_update'), clientMutationId: z.string().uuid(), actionId: z.string().uuid(), expectedVersion: z.number().int().min(1), status: z.enum(['open', 'in_progress', 'blocked', 'completed', 'cancelled']).optional(), dueAt: z.string().datetime({ offset: true }).nullable().optional(), completionEvidence: z.string().trim().max(4000).optional(), queuedAt: z.string().datetime({ offset: true })
}).strict();
export const OfflineOutcomeAssessmentSchema = z.object({
    kind: z.literal('outcome_assessment'), clientMutationId: z.string().uuid(), signalId: z.string().uuid(), payload: z.record(z.unknown()), queuedAt: z.string().datetime({ offset: true })
}).strict();
export const OfflineWorkflowMutationSchema = z.discriminatedUnion('kind', [OfflineActionUpdateSchema, OfflineOutcomeAssessmentSchema]);
/** Replay is safe only when the server endpoint is idempotent/conflict-aware. Version conflicts must remain visible. */
export function classifyOfflineReplay(status) {
    if (status === 200 || status === 201)
        return 'accepted';
    if (status === 409)
        return 'conflict';
    if (status === 408 || status === 425 || status === 429 || status >= 500)
        return 'retryable';
    return 'permanent_failure';
}
