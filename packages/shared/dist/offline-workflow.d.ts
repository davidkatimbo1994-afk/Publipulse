import { z } from 'zod';
export declare const OfflineActionUpdateSchema: z.ZodObject<{
    kind: z.ZodLiteral<"action_update">;
    clientMutationId: z.ZodString;
    actionId: z.ZodString;
    expectedVersion: z.ZodNumber;
    status: z.ZodOptional<z.ZodEnum<["open", "in_progress", "blocked", "completed", "cancelled"]>>;
    dueAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completionEvidence: z.ZodOptional<z.ZodString>;
    queuedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    expectedVersion: number;
    kind: "action_update";
    clientMutationId: string;
    actionId: string;
    queuedAt: string;
    status?: "open" | "in_progress" | "blocked" | "completed" | "cancelled" | undefined;
    dueAt?: string | null | undefined;
    completionEvidence?: string | undefined;
}, {
    expectedVersion: number;
    kind: "action_update";
    clientMutationId: string;
    actionId: string;
    queuedAt: string;
    status?: "open" | "in_progress" | "blocked" | "completed" | "cancelled" | undefined;
    dueAt?: string | null | undefined;
    completionEvidence?: string | undefined;
}>;
export declare const OfflineOutcomeAssessmentSchema: z.ZodObject<{
    kind: z.ZodLiteral<"outcome_assessment">;
    clientMutationId: z.ZodString;
    signalId: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    queuedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    signalId: string;
    kind: "outcome_assessment";
    clientMutationId: string;
    queuedAt: string;
    payload: Record<string, unknown>;
}, {
    signalId: string;
    kind: "outcome_assessment";
    clientMutationId: string;
    queuedAt: string;
    payload: Record<string, unknown>;
}>;
export declare const OfflineWorkflowMutationSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"action_update">;
    clientMutationId: z.ZodString;
    actionId: z.ZodString;
    expectedVersion: z.ZodNumber;
    status: z.ZodOptional<z.ZodEnum<["open", "in_progress", "blocked", "completed", "cancelled"]>>;
    dueAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completionEvidence: z.ZodOptional<z.ZodString>;
    queuedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    expectedVersion: number;
    kind: "action_update";
    clientMutationId: string;
    actionId: string;
    queuedAt: string;
    status?: "open" | "in_progress" | "blocked" | "completed" | "cancelled" | undefined;
    dueAt?: string | null | undefined;
    completionEvidence?: string | undefined;
}, {
    expectedVersion: number;
    kind: "action_update";
    clientMutationId: string;
    actionId: string;
    queuedAt: string;
    status?: "open" | "in_progress" | "blocked" | "completed" | "cancelled" | undefined;
    dueAt?: string | null | undefined;
    completionEvidence?: string | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"outcome_assessment">;
    clientMutationId: z.ZodString;
    signalId: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    queuedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    signalId: string;
    kind: "outcome_assessment";
    clientMutationId: string;
    queuedAt: string;
    payload: Record<string, unknown>;
}, {
    signalId: string;
    kind: "outcome_assessment";
    clientMutationId: string;
    queuedAt: string;
    payload: Record<string, unknown>;
}>]>;
export type OfflineWorkflowMutation = z.infer<typeof OfflineWorkflowMutationSchema>;
/** Replay is safe only when the server endpoint is idempotent/conflict-aware. Version conflicts must remain visible. */
export declare function classifyOfflineReplay(status: number): 'accepted' | 'replayed' | 'conflict' | 'retryable' | 'permanent_failure';
