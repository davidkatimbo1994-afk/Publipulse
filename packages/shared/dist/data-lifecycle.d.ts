import { z } from 'zod';
export declare const DataClassSchema: z.ZodEnum<["operational", "outcome_evidence", "interoperability_evidence", "audit"]>;
export type DataClass = z.infer<typeof DataClassSchema>;
export declare const RetentionPolicySchema: z.ZodObject<{
    dataClass: z.ZodEnum<["operational", "outcome_evidence", "interoperability_evidence", "audit"]>;
    retentionDays: z.ZodNumber;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    dataClass: "operational" | "outcome_evidence" | "interoperability_evidence" | "audit";
    retentionDays: number;
    active: boolean;
}, {
    dataClass: "operational" | "outcome_evidence" | "interoperability_evidence" | "audit";
    retentionDays: number;
    active: boolean;
}>;
export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;
export type RetentionDisposition = 'retain' | 'eligible_for_review' | 'held';
export type RetentionDecision = {
    disposition: RetentionDisposition;
    cutoffAt: string;
    reason: 'within_retention' | 'retention_elapsed' | 'legal_hold';
};
export declare function evaluateRetention(input: {
    createdAt: string;
    now: string;
    policy: RetentionPolicy;
    legalHold: boolean;
}): RetentionDecision;
export declare function assertDispositionReviewRequired(decision: RetentionDecision): void;
export declare function retentionCutoff(now: string, retentionDays: number): string;
