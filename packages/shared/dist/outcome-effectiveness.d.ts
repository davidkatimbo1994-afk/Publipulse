import { z } from 'zod';
export declare const LearningConfidenceSchema: z.ZodEnum<["low", "moderate", "high"]>;
export type LearningConfidence = z.infer<typeof LearningConfidenceSchema>;
export declare const InterventionEvidenceSchema: z.ZodObject<{
    recommendationId: z.ZodString;
    problemPatternId: z.ZodString;
    interventionLabel: z.ZodString;
    contextTags: z.ZodArray<z.ZodString, "many">;
    evaluations: z.ZodArray<z.ZodObject<{
        result: z.ZodEnum<["improved", "no_change", "worsened", "inconclusive"]>;
        evidenceSufficient: z.ZodBoolean;
        recurrenceAfterIntervention: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        result: "improved" | "no_change" | "worsened" | "inconclusive";
        evidenceSufficient: boolean;
        recurrenceAfterIntervention: number;
    }, {
        result: "improved" | "no_change" | "worsened" | "inconclusive";
        evidenceSufficient: boolean;
        recurrenceAfterIntervention: number;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    recommendationId: string;
    problemPatternId: string;
    interventionLabel: string;
    contextTags: string[];
    evaluations: {
        result: "improved" | "no_change" | "worsened" | "inconclusive";
        evidenceSufficient: boolean;
        recurrenceAfterIntervention: number;
    }[];
}, {
    recommendationId: string;
    problemPatternId: string;
    interventionLabel: string;
    contextTags: string[];
    evaluations: {
        result: "improved" | "no_change" | "worsened" | "inconclusive";
        evidenceSufficient: boolean;
        recurrenceAfterIntervention: number;
    }[];
}>;
export type InterventionEvidence = z.infer<typeof InterventionEvidenceSchema>;
export type InterventionLearningSummary = {
    recommendationId: string;
    evaluationCount: number;
    sufficientEvidenceCount: number;
    improvedCount: number;
    noChangeCount: number;
    worsenedCount: number;
    inconclusiveCount: number;
    recurrenceCount: number;
    classification: 'supported' | 'mixed' | 'not_supported' | 'insufficient_evidence';
    confidence: LearningConfidence;
    explanation: string;
};
/**
 * Summarizes observed intervention evaluations without claiming causation.
 * Evidence sufficiency is required before an evaluation can influence the learning class.
 */
export declare function summarizeInterventionLearning(input: InterventionEvidence): InterventionLearningSummary;
export type PersistentProblemAssessment = {
    occurrenceCount: number;
    unresolvedCount: number;
    recurrenceAfterActionCount: number;
    timeSpanDays: number;
    distinctInterventionsTried: number;
    minimumOccurrences: number;
};
export declare function classifyPersistentProblem(input: PersistentProblemAssessment): 'not_established' | 'emerging' | 'persistent' | 'intervention_resistant';
