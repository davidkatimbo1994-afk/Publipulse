import { z } from 'zod';
export declare const RootCauseStatusSchema: z.ZodEnum<["candidate", "under_review", "supported", "not_supported", "superseded"]>;
export type RootCauseStatus = z.infer<typeof RootCauseStatusSchema>;
export declare const RootCauseMechanismSchema: z.ZodEnum<["resource_constraint", "workflow_failure", "access_barrier", "service_capacity", "information_gap", "coordination_failure", "environmental_factor", "behavioural_context", "policy_or_governance", "other"]>;
export type RootCauseMechanism = z.infer<typeof RootCauseMechanismSchema>;
export declare const RootCauseHypothesisSchema: z.ZodObject<{
    problemStatement: z.ZodEffects<z.ZodString, string, string>;
    mechanism: z.ZodEnum<["resource_constraint", "workflow_failure", "access_barrier", "service_capacity", "information_gap", "coordination_failure", "environmental_factor", "behavioural_context", "policy_or_governance", "other"]>;
    hypothesis: z.ZodEffects<z.ZodString, string, string>;
    supportingEvidence: z.ZodArray<z.ZodString, "many">;
    disconfirmingEvidence: z.ZodArray<z.ZodString, "many">;
    contextTags: z.ZodArray<z.ZodString, "many">;
    confidence: z.ZodEnum<["low", "moderate", "high"]>;
    status: z.ZodEnum<["candidate", "under_review", "supported", "not_supported", "superseded"]>;
}, "strict", z.ZodTypeAny, {
    status: "supported" | "not_supported" | "candidate" | "under_review" | "superseded";
    contextTags: string[];
    problemStatement: string;
    confidence: "low" | "moderate" | "high";
    mechanism: "other" | "resource_constraint" | "workflow_failure" | "access_barrier" | "service_capacity" | "information_gap" | "coordination_failure" | "environmental_factor" | "behavioural_context" | "policy_or_governance";
    hypothesis: string;
    supportingEvidence: string[];
    disconfirmingEvidence: string[];
}, {
    status: "supported" | "not_supported" | "candidate" | "under_review" | "superseded";
    contextTags: string[];
    problemStatement: string;
    confidence: "low" | "moderate" | "high";
    mechanism: "other" | "resource_constraint" | "workflow_failure" | "access_barrier" | "service_capacity" | "information_gap" | "coordination_failure" | "environmental_factor" | "behavioural_context" | "policy_or_governance";
    hypothesis: string;
    supportingEvidence: string[];
    disconfirmingEvidence: string[];
}>;
export type RootCauseHypothesis = z.infer<typeof RootCauseHypothesisSchema>;
export type RecurrenceClusterObservation = {
    signalId: string;
    category: string;
    administrativeAreaCode: string;
    observedAt: string;
    issueTags: string[];
    failureModes: string[];
};
export type RecurrenceSimilarity = {
    score: number;
    reasons: string[];
    comparable: boolean;
};
/**
 * Explainable recurrence similarity. This is pattern detection, not causal inference.
 * A cluster requires a comparable category and administrative area; issue/failure tags
 * increase confidence but never prove that two events share the same underlying cause.
 */
export declare function compareRecurrenceObservations(a: RecurrenceClusterObservation, b: RecurrenceClusterObservation): RecurrenceSimilarity;
export type RecurrenceAssessment = {
    occurrenceCount: number;
    unresolvedOccurrences: number;
    recurrenceAfterAction: number;
    minimumOccurrences: number;
    similarityThreshold: number;
};
export declare function classifyRecurrencePattern(input: RecurrenceAssessment): 'isolated' | 'emerging' | 'persistent';
