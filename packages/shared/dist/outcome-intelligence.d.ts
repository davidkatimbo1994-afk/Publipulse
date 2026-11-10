import { z } from 'zod';
export declare const OutcomeStateSchema: z.ZodEnum<["not_assessed", "resolution_unverified", "resolved", "improved", "no_change", "worsened", "inconclusive", "reopened", "recurrent"]>;
export type OutcomeState = z.infer<typeof OutcomeStateSchema>;
export type OutcomeEvidence = {
    hasFollowUp: boolean;
    hasResolutionEvidence: boolean;
    result?: 'improved' | 'no_change' | 'worsened' | 'inconclusive' | null;
    followUpAt?: string | null;
    closedAt?: string | null;
    reopenedAt?: string | null;
    recurrenceCount?: number;
};
export declare function classifyOutcome(e: OutcomeEvidence): OutcomeState;
export type RecurrenceObservation = {
    category: string;
    administrativeAreaCode: string;
    observedAt: string;
    summary?: string;
};
/** Stable, non-identifying pattern key. It deliberately excludes raw case text and user IDs. */
export declare function recurrencePatternKey(o: RecurrenceObservation, windowDays?: number): string;
export type OutcomeGap = {
    code: 'CLOSED_WITHOUT_RESOLUTION' | 'RECURRING_AFTER_ACTION' | 'OUTCOME_NOT_MEASURED' | 'OUTCOME_WORSENED' | 'OUTCOME_INCONCLUSIVE';
    severity: 'high' | 'watch';
    explanation: string;
    recommendedNextStep: string;
};
export declare function identifyOutcomeGaps(e: OutcomeEvidence): OutcomeGap[];
export type ExpertRecommendationInput = {
    problemStatement: string;
    proposedIntervention: string;
    rationale: string;
    evidenceReferences: string[];
    contextTags: string[];
    confidence: 'low' | 'moderate' | 'high';
};
export declare const ExpertRecommendationSchema: z.ZodObject<{
    problemStatement: z.ZodEffects<z.ZodString, string, string>;
    proposedIntervention: z.ZodEffects<z.ZodString, string, string>;
    rationale: z.ZodEffects<z.ZodString, string, string>;
    evidenceReferences: z.ZodArray<z.ZodString, "many">;
    contextTags: z.ZodArray<z.ZodString, "many">;
    confidence: z.ZodEnum<["low", "moderate", "high"]>;
}, "strict", z.ZodTypeAny, {
    rationale: string;
    contextTags: string[];
    problemStatement: string;
    proposedIntervention: string;
    evidenceReferences: string[];
    confidence: "low" | "moderate" | "high";
}, {
    rationale: string;
    contextTags: string[];
    problemStatement: string;
    proposedIntervention: string;
    evidenceReferences: string[];
    confidence: "low" | "moderate" | "high";
}>;
