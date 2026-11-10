import { z } from 'zod';
export const OutcomeReviewReasonSchema = z.enum([
    'closed_without_resolution',
    'outcome_not_measured',
    'recurring_after_action',
    'outcome_worsened',
    'outcome_inconclusive'
]);
export const OutcomeReviewPrioritySchema = z.enum(['critical', 'high', 'watch']);
export function buildOutcomeReviewFindings(input) {
    const findings = [];
    if (input.closed && !input.resolutionEvidence)
        findings.push({
            reason: 'closed_without_resolution', priority: 'critical', requiresReopening: true,
            requiresExpertReview: true, nextStep: 'Reopen outcome review and establish what evidence is required to demonstrate resolution.'
        });
    if (input.closed && !input.followUpMeasured)
        findings.push({
            reason: 'outcome_not_measured', priority: 'high', requiresReopening: true,
            requiresExpertReview: false, nextStep: 'Define a bounded follow-up measure and review date before treating the response as successful.'
        });
    if (input.recurrenceCount > 0)
        findings.push({
            reason: 'recurring_after_action', priority: 'critical', requiresReopening: true,
            requiresExpertReview: true, nextStep: 'Link prior occurrences, compare interventions, and request contextual expert review of the persistent mechanism.'
        });
    if (input.result === 'worsened')
        findings.push({
            reason: 'outcome_worsened', priority: 'critical', requiresReopening: true,
            requiresExpertReview: true, nextStep: 'Escalate for human review and reassess whether the intervention should be changed, stopped, or supplemented.'
        });
    if (input.result === 'inconclusive')
        findings.push({
            reason: 'outcome_inconclusive', priority: 'watch', requiresReopening: true,
            requiresExpertReview: false, nextStep: 'Record the uncertainty, identify the missing evidence, and schedule a bounded reassessment.'
        });
    return findings;
}
export function classifyInterventionLearning(input) {
    if (!input.evidenceSufficient || input.observedResult === 'inconclusive')
        return 'insufficient_evidence';
    if (input.observedResult === 'improved' && input.recurrenceAfterIntervention === 0)
        return 'supported';
    if (input.observedResult === 'improved' && input.recurrenceAfterIntervention > 0)
        return 'mixed';
    if (input.observedResult === 'no_change')
        return 'not_supported';
    return 'not_supported';
}
