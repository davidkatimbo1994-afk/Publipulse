import { z } from 'zod';
import { publicHealthNarrative } from './data-boundary.js';
export const OutcomeStateSchema = z.enum([
    'not_assessed', 'resolution_unverified', 'resolved', 'improved',
    'no_change', 'worsened', 'inconclusive', 'reopened', 'recurrent'
]);
export function classifyOutcome(e) {
    if ((e.recurrenceCount ?? 0) > 0)
        return 'recurrent';
    if (e.reopenedAt && e.closedAt && Date.parse(e.reopenedAt) >= Date.parse(e.closedAt))
        return 'reopened';
    if (!e.hasFollowUp || !e.hasResolutionEvidence)
        return 'resolution_unverified';
    if (!e.result)
        return 'inconclusive';
    return e.result;
}
/** Stable, non-identifying pattern key. It deliberately excludes raw case text and user IDs. */
export function recurrencePatternKey(o, windowDays = 30) {
    const t = Date.parse(o.observedAt);
    if (!Number.isFinite(t))
        throw new Error('observedAt must be a valid ISO timestamp');
    const bucket = Math.floor(t / (windowDays * 86_400_000));
    return `${o.category.trim().toLowerCase()}|${o.administrativeAreaCode.trim().toLowerCase()}|${windowDays}|${bucket}`;
}
export function identifyOutcomeGaps(e) {
    const gaps = [];
    if (e.closedAt && (!e.hasFollowUp || !e.hasResolutionEvidence)) {
        gaps.push({ code: 'CLOSED_WITHOUT_RESOLUTION', severity: 'high', explanation: 'The case has a recorded closure point but lacks sufficient evidence that the underlying issue was resolved.', recommendedNextStep: 'Reopen outcome review, identify the unresolved mechanism, and record a follow-up measurement or explicit reason evidence is unavailable.' });
    }
    if ((e.recurrenceCount ?? 0) > 0) {
        gaps.push({ code: 'RECURRING_AFTER_ACTION', severity: 'high', explanation: 'A similar concern has recurred after prior response activity.', recommendedNextStep: 'Link the recurrence to prior cases, review previous interventions, and request structured expert input on the persistent cause.' });
    }
    if (e.closedAt && !e.hasFollowUp) {
        gaps.push({ code: 'OUTCOME_NOT_MEASURED', severity: 'high', explanation: 'The case was closed without a follow-up measurement.', recommendedNextStep: 'Define an appropriate outcome indicator and follow-up interval before treating the response as successful.' });
    }
    if (e.result === 'worsened')
        gaps.push({ code: 'OUTCOME_WORSENED', severity: 'high', explanation: 'The observed outcome worsened after the assessed response.', recommendedNextStep: 'Escalate for human review and document whether the intervention should be changed, stopped, or supplemented.' });
    if (e.result === 'inconclusive')
        gaps.push({ code: 'OUTCOME_INCONCLUSIVE', severity: 'watch', explanation: 'Available evidence is insufficient to determine whether the response achieved the intended outcome.', recommendedNextStep: 'Record the uncertainty, identify missing evidence, and schedule a bounded reassessment.' });
    return gaps;
}
export const ExpertRecommendationSchema = z.object({
    problemStatement: publicHealthNarrative(z.string().trim().min(10).max(2000)),
    proposedIntervention: publicHealthNarrative(z.string().trim().min(10).max(3000)),
    rationale: publicHealthNarrative(z.string().trim().min(10).max(3000)),
    evidenceReferences: z.array(z.string().trim().min(1).max(500)).max(20),
    contextTags: z.array(z.string().trim().min(1).max(80)).max(30),
    confidence: z.enum(['low', 'moderate', 'high'])
}).strict();
