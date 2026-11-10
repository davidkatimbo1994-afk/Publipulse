import { z } from 'zod';
/** Area-level environmental or socio-economic context with provenance. Aggregates only; never person-level data. */
export declare const ExternalContextObservationSchema: z.ZodEffects<z.ZodObject<{
    administrativeAreaCode: z.ZodString;
    metricCode: z.ZodString;
    value: z.ZodNumber;
    unit: z.ZodString;
    periodStart: z.ZodEffects<z.ZodString, string, string>;
    periodEnd: z.ZodEffects<z.ZodString, string, string>;
    sourceLabel: z.ZodString;
    sourceUri: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    value: number;
    unit: string;
    administrativeAreaCode: string;
    metricCode: string;
    periodStart: string;
    periodEnd: string;
    sourceLabel: string;
    sourceUri?: string | undefined;
}, {
    value: number;
    unit: string;
    administrativeAreaCode: string;
    metricCode: string;
    periodStart: string;
    periodEnd: string;
    sourceLabel: string;
    sourceUri?: string | undefined;
}>, {
    value: number;
    unit: string;
    administrativeAreaCode: string;
    metricCode: string;
    periodStart: string;
    periodEnd: string;
    sourceLabel: string;
    sourceUri?: string | undefined;
}, {
    value: number;
    unit: string;
    administrativeAreaCode: string;
    metricCode: string;
    periodStart: string;
    periodEnd: string;
    sourceLabel: string;
    sourceUri?: string | undefined;
}>;
export type ExternalContextObservation = z.infer<typeof ExternalContextObservationSchema>;
export declare const CONTEXT_WINDOW_DAYS_BEFORE = 28;
export declare const CONTEXT_WINDOW_DAYS_AFTER = 7;
export declare const CONTEXT_MIN_BASELINE = 3;
export declare const CONTEXT_SIMILAR_BAND = 0.2;
export interface ContextValue {
    metricCode: string;
    unit: string;
    value: number;
}
export interface ContextComparison {
    metricCode: string;
    unit: string;
    windowMean: number;
    windowCount: number;
    baselineMean: number | null;
    baselineCount: number;
    ratio: number | null;
    deviation: 'above' | 'below' | 'similar' | 'insufficient_baseline';
}
/**
 * Compares each metric's mean around a signal with its mean over earlier periods of the same area and unit.
 * This describes association in time only. It never asserts cause, and needs at least three baseline periods.
 */
export declare function compareContextToBaseline(windowValues: ReadonlyArray<ContextValue>, baselineValues: ReadonlyArray<ContextValue>): ContextComparison[];
/** The date range of context examined around a signal's observed time (UTC dates). */
export declare function contextWindowFor(observedAt: string): {
    from: string;
    to: string;
};
