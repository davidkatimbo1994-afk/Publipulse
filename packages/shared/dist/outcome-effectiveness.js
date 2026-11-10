import { z } from 'zod';
export const LearningConfidenceSchema = z.enum(['low', 'moderate', 'high']);
export const InterventionEvidenceSchema = z.object({
    recommendationId: z.string().uuid(),
    problemPatternId: z.string().uuid(),
    interventionLabel: z.string().trim().min(3).max(200),
    contextTags: z.array(z.string().trim().min(1).max(80)).max(30),
    evaluations: z.array(z.object({
        result: z.enum(['improved', 'no_change', 'worsened', 'inconclusive']),
        evidenceSufficient: z.boolean(),
        recurrenceAfterIntervention: z.number().int().min(0)
    }).strict()).max(100)
}).strict();
/**
 * Summarizes observed intervention evaluations without claiming causation.
 * Evidence sufficiency is required before an evaluation can influence the learning class.
 */
export function summarizeInterventionLearning(input) {
    const e = input.evaluations;
    const sufficient = e.filter(x => x.evidenceSufficient);
    const improved = sufficient.filter(x => x.result === 'improved').length;
    const noChange = sufficient.filter(x => x.result === 'no_change').length;
    const worsened = sufficient.filter(x => x.result === 'worsened').length;
    const inconclusive = e.filter(x => x.result === 'inconclusive' || !x.evidenceSufficient).length;
    const recurrenceCount = e.reduce((sum, x) => sum + x.recurrenceAfterIntervention, 0);
    let classification;
    if (sufficient.length === 0)
        classification = 'insufficient_evidence';
    else if (worsened > 0 && improved === 0)
        classification = 'not_supported';
    else if (improved > 0 && recurrenceCount > 0)
        classification = 'mixed';
    else if (improved > 0 && noChange === 0 && worsened === 0)
        classification = 'supported';
    else if (improved > 0 && (noChange > 0 || worsened > 0))
        classification = 'mixed';
    else
        classification = 'not_supported';
    const confidence = sufficient.length >= 5 && inconclusive === 0 ? 'high' :
        sufficient.length >= 2 ? 'moderate' : 'low';
    return {
        recommendationId: input.recommendationId,
        evaluationCount: e.length,
        sufficientEvidenceCount: sufficient.length,
        improvedCount: improved,
        noChangeCount: noChange,
        worsenedCount: worsened,
        inconclusiveCount: inconclusive,
        recurrenceCount,
        classification,
        confidence,
        explanation: classification === 'supported'
            ? 'Observed evaluations consistently show improvement without recorded recurrence; this is operational learning evidence, not proof of causation.'
            : classification === 'mixed'
                ? 'Some improvement was observed, but non-improvement, worsening, or recurrence limits confidence in durable effectiveness.'
                : classification === 'not_supported'
                    ? 'Observed sufficient-evidence evaluations do not support retaining this intervention as an effective response in the evaluated context.'
                    : 'There is not enough sufficient outcome evidence to make a reliable learning classification.'
    };
}
export function classifyPersistentProblem(input) {
    if (!Number.isInteger(input.occurrenceCount) || input.occurrenceCount < 1)
        throw new Error('occurrenceCount must be a positive integer');
    if (!Number.isInteger(input.unresolvedCount) || input.unresolvedCount < 0 || input.unresolvedCount > input.occurrenceCount)
        throw new Error('unresolvedCount must be between 0 and occurrenceCount');
    if (!Number.isInteger(input.recurrenceAfterActionCount) || input.recurrenceAfterActionCount < 0 || input.recurrenceAfterActionCount > input.occurrenceCount)
        throw new Error('recurrenceAfterActionCount must be between 0 and occurrenceCount');
    if (!Number.isInteger(input.distinctInterventionsTried) || input.distinctInterventionsTried < 0)
        throw new Error('distinctInterventionsTried must be a non-negative integer');
    if (!Number.isInteger(input.minimumOccurrences) || input.minimumOccurrences < 1)
        throw new Error('minimumOccurrences must be a positive integer');
    if (input.timeSpanDays < 0)
        throw new Error('timeSpanDays must be non-negative');
    if (input.occurrenceCount < input.minimumOccurrences)
        return 'not_established';
    if (input.unresolvedCount === 0 && input.recurrenceAfterActionCount === 0)
        return 'emerging';
    if (input.distinctInterventionsTried >= 2 && input.recurrenceAfterActionCount > 0)
        return 'intervention_resistant';
    return 'persistent';
}
