import { z } from 'zod';
import { assertPublicHealthNarrative } from './data-boundary.js';
const iso = z.string().datetime({ offset: true });
export const WeeklyDecisionInputSchema = z.object({
    clientMutationId: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/),
    weekStart: iso,
    weekEnd: iso,
    administrativeAreaCode: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._-]+$/),
    agendaCode: z.enum(['ownership_gap', 'unresolved_outcome', 'recurrence', 'response_blocker', 'intervention_resistant', 'feedback_gap', 'integration_gap']),
    decision: z.enum(['continue_current_approach', 'change_approach', 'escalate_programme_redesign', 'insufficient_evidence']),
    rationale: z.string().trim().min(10).max(2000),
    nextCheckAt: iso,
    ownerRole: z.enum(['programme_lead', 'district_lead', 'surveillance_lead', 'response_lead', 'laboratory_lead', 'other']),
    evidenceDigest: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/).optional(),
}).superRefine((value, ctx) => {
    const start = Date.parse(value.weekStart), end = Date.parse(value.weekEnd), check = Date.parse(value.nextCheckAt);
    if (!(start < end))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weekEnd'], message: 'week window must be ordered' });
    if (end - start > 31 * 86400000)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weekEnd'], message: 'weekly review window exceeds 31 days' });
    if (check < end)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nextCheckAt'], message: 'next check must be on or after review end' });
    const code = (() => { try {
        assertPublicHealthNarrative(value.rationale);
        return null;
    }
    catch (error) {
        return error instanceof Error ? error.message : 'direct_identifier_not_allowed';
    } })();
    if (code)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rationale'], message: code });
});
