import { z } from 'zod';
export declare const DecisionIntakeSchema: z.ZodObject<{
    investigationId: z.ZodOptional<z.ZodString>;
    decision: z.ZodEnum<["continue_review", "verify", "escalate", "dismiss", "close"]>;
    rationale: z.ZodEffects<z.ZodString, string, string>;
    evidenceSummary: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    decision: "dismiss" | "continue_review" | "verify" | "escalate" | "close";
    rationale: string;
    investigationId?: string | undefined;
    evidenceSummary?: string | undefined;
}, {
    decision: "dismiss" | "continue_review" | "verify" | "escalate" | "close";
    rationale: string;
    investigationId?: string | undefined;
    evidenceSummary?: string | undefined;
}>;
export type DecisionIntake = z.infer<typeof DecisionIntakeSchema>;
export declare const ResponseActionIntakeSchema: z.ZodObject<{
    decisionId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    ownerUserId: z.ZodString;
    dueAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    title: string;
    ownerUserId: string;
    decisionId?: string | undefined;
    description?: string | undefined;
    dueAt?: string | undefined;
}, {
    title: string;
    ownerUserId: string;
    decisionId?: string | undefined;
    description?: string | undefined;
    dueAt?: string | undefined;
}>;
export type ResponseActionIntake = z.infer<typeof ResponseActionIntakeSchema>;
export declare const ResponseActionUpdateSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    expectedVersion: z.ZodNumber;
    status: z.ZodOptional<z.ZodEnum<["open", "in_progress", "blocked", "completed", "cancelled"]>>;
    dueAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completionEvidence: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
}, "strict", z.ZodTypeAny, {
    expectedVersion: number;
    status?: "open" | "in_progress" | "blocked" | "completed" | "cancelled" | undefined;
    dueAt?: string | null | undefined;
    completionEvidence?: string | null | undefined;
}, {
    expectedVersion: number;
    status?: "open" | "in_progress" | "blocked" | "completed" | "cancelled" | undefined;
    dueAt?: string | null | undefined;
    completionEvidence?: string | null | undefined;
}>, {
    expectedVersion: number;
    status?: "open" | "in_progress" | "blocked" | "completed" | "cancelled" | undefined;
    dueAt?: string | null | undefined;
    completionEvidence?: string | null | undefined;
}, {
    expectedVersion: number;
    status?: "open" | "in_progress" | "blocked" | "completed" | "cancelled" | undefined;
    dueAt?: string | null | undefined;
    completionEvidence?: string | null | undefined;
}>, {
    expectedVersion: number;
    status?: "open" | "in_progress" | "blocked" | "completed" | "cancelled" | undefined;
    dueAt?: string | null | undefined;
    completionEvidence?: string | null | undefined;
}, {
    expectedVersion: number;
    status?: "open" | "in_progress" | "blocked" | "completed" | "cancelled" | undefined;
    dueAt?: string | null | undefined;
    completionEvidence?: string | null | undefined;
}>;
export type ResponseActionUpdate = z.infer<typeof ResponseActionUpdateSchema>;
