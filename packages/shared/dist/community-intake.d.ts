import { z } from 'zod';
/** A reviewer's decision on one pending community submission. */
export declare const CommunityReviewSchema: z.ZodDiscriminatedUnion<"decision", [z.ZodObject<{
    decision: z.ZodLiteral<"promote">;
    summary: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    category: z.ZodOptional<z.ZodEnum<["unusual_illness", "environmental_hazard", "service_disruption", "other"]>>;
    precision: z.ZodOptional<z.ZodEnum<["community", "district"]>>;
}, "strict", z.ZodTypeAny, {
    decision: "promote";
    summary?: string | undefined;
    category?: "other" | "unusual_illness" | "environmental_hazard" | "service_disruption" | undefined;
    precision?: "community" | "district" | undefined;
}, {
    decision: "promote";
    summary?: string | undefined;
    category?: "other" | "unusual_illness" | "environmental_hazard" | "service_disruption" | undefined;
    precision?: "community" | "district" | undefined;
}>, z.ZodObject<{
    decision: z.ZodLiteral<"merge">;
    signalId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    decision: "merge";
    signalId: string;
    reason?: string | undefined;
}, {
    decision: "merge";
    signalId: string;
    reason?: string | undefined;
}>, z.ZodObject<{
    decision: z.ZodLiteral<"dismiss">;
    reason: z.ZodString;
}, "strict", z.ZodTypeAny, {
    decision: "dismiss";
    reason: string;
}, {
    decision: "dismiss";
    reason: string;
}>]>;
export type CommunityReview = z.infer<typeof CommunityReviewSchema>;
/** Starting limits from ADR-008. They are configuration, to be calibrated in a pilot. */
export interface CommunityLimits {
    senderPerHour: number;
    senderPerDay: number;
    organizationPerHour: number;
    cooldownRejects: number;
    cooldownHours: number;
}
export declare const DEFAULT_COMMUNITY_LIMITS: CommunityLimits;
