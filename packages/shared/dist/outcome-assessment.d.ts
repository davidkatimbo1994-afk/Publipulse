import { z } from 'zod';
/** An assessment records observed change; it never treats task completion as proof of impact. */
export declare const OutcomeAssessmentSchema: z.ZodEffects<z.ZodObject<{
    actionId: z.ZodString;
    indicatorName: z.ZodString;
    result: z.ZodEnum<["improved", "no_change", "worsened", "inconclusive"]>;
    baselineValue: z.ZodOptional<z.ZodNumber>;
    targetValue: z.ZodOptional<z.ZodNumber>;
    followUpValue: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
    evidenceSummary: z.ZodEffects<z.ZodString, string, string>;
    evidenceReference: z.ZodOptional<z.ZodString>;
    uncertaintyNote: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    assessedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    evidenceSummary: string;
    actionId: string;
    indicatorName: string;
    result: "improved" | "no_change" | "worsened" | "inconclusive";
    assessedAt: string;
    unit?: string | undefined;
    baselineValue?: number | undefined;
    targetValue?: number | undefined;
    followUpValue?: number | undefined;
    evidenceReference?: string | undefined;
    uncertaintyNote?: string | undefined;
}, {
    evidenceSummary: string;
    actionId: string;
    indicatorName: string;
    result: "improved" | "no_change" | "worsened" | "inconclusive";
    assessedAt: string;
    unit?: string | undefined;
    baselineValue?: number | undefined;
    targetValue?: number | undefined;
    followUpValue?: number | undefined;
    evidenceReference?: string | undefined;
    uncertaintyNote?: string | undefined;
}>, {
    evidenceSummary: string;
    actionId: string;
    indicatorName: string;
    result: "improved" | "no_change" | "worsened" | "inconclusive";
    assessedAt: string;
    unit?: string | undefined;
    baselineValue?: number | undefined;
    targetValue?: number | undefined;
    followUpValue?: number | undefined;
    evidenceReference?: string | undefined;
    uncertaintyNote?: string | undefined;
}, {
    evidenceSummary: string;
    actionId: string;
    indicatorName: string;
    result: "improved" | "no_change" | "worsened" | "inconclusive";
    assessedAt: string;
    unit?: string | undefined;
    baselineValue?: number | undefined;
    targetValue?: number | undefined;
    followUpValue?: number | undefined;
    evidenceReference?: string | undefined;
    uncertaintyNote?: string | undefined;
}>;
export type OutcomeAssessment = z.infer<typeof OutcomeAssessmentSchema>;
