import { z } from 'zod';
import { publicHealthNarrative } from './data-boundary.js';
export const RootCauseStatusSchema = z.enum(['candidate', 'under_review', 'supported', 'not_supported', 'superseded']);
export const RootCauseMechanismSchema = z.enum([
    'resource_constraint',
    'workflow_failure',
    'access_barrier',
    'service_capacity',
    'information_gap',
    'coordination_failure',
    'environmental_factor',
    'behavioural_context',
    'policy_or_governance',
    'other'
]);
export const RootCauseHypothesisSchema = z.object({
    problemStatement: publicHealthNarrative(z.string().trim().min(10).max(2000)),
    mechanism: RootCauseMechanismSchema,
    hypothesis: publicHealthNarrative(z.string().trim().min(10).max(3000)),
    supportingEvidence: z.array(z.string().trim().min(1).max(500)).max(20),
    disconfirmingEvidence: z.array(z.string().trim().min(1).max(500)).max(20),
    contextTags: z.array(z.string().trim().min(1).max(80)).max(30),
    confidence: z.enum(['low', 'moderate', 'high']),
    status: RootCauseStatusSchema
}).strict();
function normalizedSet(values) {
    return new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean));
}
function overlap(a, b) {
    if (!a.size || !b.size)
        return 0;
    let shared = 0;
    for (const value of a)
        if (b.has(value))
            shared += 1;
    return shared / Math.max(a.size, b.size);
}
/**
 * Explainable recurrence similarity. This is pattern detection, not causal inference.
 * A cluster requires a comparable category and administrative area; issue/failure tags
 * increase confidence but never prove that two events share the same underlying cause.
 */
export function compareRecurrenceObservations(a, b) {
    const reasons = [];
    if (a.category.trim().toLowerCase() !== b.category.trim().toLowerCase())
        return { score: 0, reasons: [], comparable: false };
    if (a.administrativeAreaCode.trim().toLowerCase() !== b.administrativeAreaCode.trim().toLowerCase())
        return { score: 0, reasons: [], comparable: false };
    const issueOverlap = overlap(normalizedSet(a.issueTags), normalizedSet(b.issueTags));
    const failureOverlap = overlap(normalizedSet(a.failureModes), normalizedSet(b.failureModes));
    let score = 0.5; // same category + area
    reasons.push('same_category_and_administrative_area');
    if (issueOverlap > 0) {
        score += 0.25 * issueOverlap;
        reasons.push('shared_issue_tags');
    }
    if (failureOverlap > 0) {
        score += 0.25 * failureOverlap;
        reasons.push('shared_failure_modes');
    }
    return { score: Math.min(1, Number(score.toFixed(4))), reasons, comparable: true };
}
export function classifyRecurrencePattern(input) {
    if (input.occurrenceCount < input.minimumOccurrences)
        return 'isolated';
    if (input.unresolvedOccurrences > 0 || input.recurrenceAfterAction > 0)
        return 'persistent';
    return 'emerging';
}
