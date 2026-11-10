import { z } from 'zod';
import { publicHealthNarrative } from './data-boundary.js';
/** An assessment records observed change; it never treats task completion as proof of impact. */
export const OutcomeAssessmentSchema = z.object({
    actionId: z.string().uuid(),
    indicatorName: z.string().trim().min(2).max(240),
    result: z.enum(['improved', 'no_change', 'worsened', 'inconclusive']),
    baselineValue: z.number().finite().optional(),
    targetValue: z.number().finite().optional(),
    followUpValue: z.number().finite().optional(),
    unit: z.string().trim().max(80).optional(),
    evidenceSummary: publicHealthNarrative(z.string().trim().min(5).max(3000)),
    // Mirrors DB check outcomes_evidence_source_length_check (1..240 after trim).
    evidenceReference: z.string().trim().min(1).max(240).optional(),
    uncertaintyNote: publicHealthNarrative(z.string().trim().max(3000)).optional(),
    assessedAt: z.string().datetime({ offset: true })
}).strict().superRefine((value, ctx) => {
    if (value.targetValue !== undefined && value.baselineValue === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baselineValue'], message: 'baselineValue is required when targetValue is supplied' });
    }
    if (value.followUpValue === undefined && value.result !== 'inconclusive') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['followUpValue'], message: 'follow-up measurement is required unless result is inconclusive' });
    }
    if (value.result === 'inconclusive' && !value.uncertaintyNote?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['uncertaintyNote'], message: 'uncertaintyNote is required for inconclusive assessments' });
    }
});
