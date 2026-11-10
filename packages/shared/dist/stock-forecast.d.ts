import { z } from 'zod';
/** Aggregate stock counts only; no patient-level or dispensing records. */
export declare const StockSnapshotSchema: z.ZodObject<{
    administrativeAreaCode: z.ZodString;
    commodityCode: z.ZodString;
    unit: z.ZodString;
    quantityOnHand: z.ZodEffects<z.ZodNumber, number, number>;
    /** Quantity received since the previous snapshot of this series (0 if none). */
    quantityReceived: z.ZodDefault<z.ZodEffects<z.ZodNumber, number, number>>;
    observedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    unit: string;
    observedAt: string;
    administrativeAreaCode: string;
    commodityCode: string;
    quantityOnHand: number;
    quantityReceived: number;
}, {
    unit: string;
    observedAt: string;
    administrativeAreaCode: string;
    commodityCode: string;
    quantityOnHand: number;
    quantityReceived?: number | undefined;
}>;
export type StockSnapshot = z.infer<typeof StockSnapshotSchema>;
export declare const STOCK_ALERT_LEVELS: readonly ["critical", "warning", "ok", "insufficient_data"];
export type StockAlertLevel = (typeof STOCK_ALERT_LEVELS)[number];
export declare const STOCK_STALE_AFTER_DAYS = 30;
export declare const STOCK_DEFAULT_LEAD_TIME_DAYS = 7;
export interface StockPoint {
    quantityOnHand: number;
    quantityReceived: number;
    observedAt: string;
}
export interface StockForecast {
    level: StockAlertLevel;
    dailyConsumption: number | null;
    daysOfStockLeft: number | null;
    projectedStockoutOn: string | null;
    intervalsUsed: number;
    inconsistentIntervals: number;
    confidence: 'insufficient' | 'low' | 'moderate';
    stale: boolean;
}
/**
 * Consumption velocity = (previous on-hand + received - current on-hand) / days, pooled over the supplied snapshots.
 * Assumes steady consumption and ignores deliveries still in transit. Intervals where stock rose without a recorded
 * receipt, or with no elapsed time, are skipped and counted rather than guessed at.
 * Alert: critical when days left <= lead time, warning when <= 2x lead time.
 */
export declare function forecastStock(points: ReadonlyArray<StockPoint>, opts: {
    now: Date;
    leadTimeDays?: number;
}): StockForecast;
export interface StockSeriesForecast extends StockForecast {
    administrativeAreaCode: string;
    commodityCode: string;
    unit: string;
    quantityOnHand: number;
    lastObservedAt: string;
    /** Draft for the existing signal intake; a person submits it. Nothing is created automatically. */
    suggestedSignal: {
        category: 'service_disruption';
        summary: string;
        observedAt: string;
        location: {
            administrativeAreaCode: string;
            precision: 'facility';
        };
        sourceType: 'facility_report';
    } | null;
}
export declare function buildSeriesForecast(series: {
    administrativeAreaCode: string;
    commodityCode: string;
    unit: string;
    points: ReadonlyArray<StockPoint>;
}, opts: {
    now: Date;
    leadTimeDays?: number;
}): StockSeriesForecast;
