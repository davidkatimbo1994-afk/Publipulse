import { z } from 'zod';
export declare const ReconciliationStatusSchema: z.ZodEnum<["exact", "within_tolerance", "mismatch", "not_comparable"]>;
export type ReconciliationStatus = z.infer<typeof ReconciliationStatusSchema>;
export declare const ReconciliationInputSchema: z.ZodObject<{
    localRecordCount: z.ZodNumber;
    externalRecordCount: z.ZodNumber;
    localTotal: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    externalTotal: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    tolerance: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    localRecordCount: number;
    externalRecordCount: number;
    tolerance: number;
    localTotal?: number | null | undefined;
    externalTotal?: number | null | undefined;
}, {
    localRecordCount: number;
    externalRecordCount: number;
    localTotal?: number | null | undefined;
    externalTotal?: number | null | undefined;
    tolerance?: number | undefined;
}>;
export type ReconciliationInput = z.infer<typeof ReconciliationInputSchema>;
export declare const ReconciliationSnapshotInputSchema: z.ZodObject<{
    exchangeJobId: z.ZodString;
    provider: z.ZodEnum<["dhis2", "fhir", "csv", "other"]>;
    externalRecordCount: z.ZodNumber;
    externalTotal: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    tolerance: z.ZodDefault<z.ZodNumber>;
    evidenceDigest: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    provider: "other" | "dhis2" | "csv" | "fhir";
    externalRecordCount: number;
    tolerance: number;
    exchangeJobId: string;
    externalTotal?: number | null | undefined;
    evidenceDigest?: string | undefined;
}, {
    provider: "other" | "dhis2" | "csv" | "fhir";
    externalRecordCount: number;
    exchangeJobId: string;
    externalTotal?: number | null | undefined;
    tolerance?: number | undefined;
    evidenceDigest?: string | undefined;
}>;
export type ReconciliationSnapshotInput = z.infer<typeof ReconciliationSnapshotInputSchema>;
export type ReconciliationResult = {
    status: ReconciliationStatus;
    countDelta: number;
    delta: number | null;
    reason: string;
};
/**
 * Reconciliation is deliberately conservative. Missing totals are not treated as zero,
 * and any count mismatch remains visible even when totals happen to match.
 */
export declare function reconcileExchange(input: ReconciliationInput): ReconciliationResult;
export declare function evidenceDigestInput(parts: readonly string[]): string;
