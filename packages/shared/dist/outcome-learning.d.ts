import { z } from 'zod';
export declare const OutcomeReviewReasonSchema: z.ZodEnum<["closed_without_resolution", "outcome_not_measured", "recurring_after_action", "outcome_worsened", "outcome_inconclusive"]>;
export type OutcomeReviewReason = z.infer<typeof OutcomeReviewReasonSchema>;
export declare const OutcomeReviewPrioritySchema: z.ZodEnum<["critical", "high", "watch"]>;
export type OutcomeReviewPriority = z.infer<typeof OutcomeReviewPrioritySchema>;
export type OutcomeReviewInput = {
    closed: boolean;
    followUpMeasured: boolean;
    resolutionEvidence: boolean;
    recurrenceCount: number;
    result?: 'improved' | 'no_change' | 'worsened' | 'inconclusive' | null;
};
export type OutcomeReviewFinding = {
    reason: OutcomeReviewReason;
    priority: OutcomeReviewPriority;
    requiresReopening: boolean;
    requiresExpertReview: boolean;
    nextStep: string;
};
export declare function buildOutcomeReviewFindings(input: OutcomeReviewInput): OutcomeReviewFinding[];
export type InterventionEvaluation = {
    recommendationId: string;
    observedResult: 'improved' | 'no_change' | 'worsened' | 'inconclusive';
    evidenceSufficient: boolean;
    recurrenceAfterIntervention: number;
};
export declare function classifyInterventionLearning(input: InterventionEvaluation): 'supported' | 'mixed' | 'not_supported' | 'insufficient_evidence';
