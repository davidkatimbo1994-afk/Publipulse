import { z } from 'zod';
const CODE = /^[A-Za-z0-9._-]+$/;
const qty = z.number().finite().min(0).max(100_000_000_000).refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: 'at most two decimal places' });
/** Aggregate stock counts only; no patient-level or dispensing records. */
export const StockSnapshotSchema = z.object({
    administrativeAreaCode: z.string().trim().min(1).max(80).regex(CODE),
    commodityCode: z.string().trim().min(1).max(80).regex(CODE),
    unit: z.string().trim().min(1).max(40),
    quantityOnHand: qty,
    /** Quantity received since the previous snapshot of this series (0 if none). */
    quantityReceived: qty.default(0),
    observedAt: z.string().datetime({ offset: true })
}).strict();
export const STOCK_ALERT_LEVELS = ['critical', 'warning', 'ok', 'insufficient_data'];
export const STOCK_STALE_AFTER_DAYS = 30;
export const STOCK_DEFAULT_LEAD_TIME_DAYS = 7;
const DAY_MS = 86_400_000;
const round1 = (v) => Math.round(v * 10) / 10;
/**
 * Consumption velocity = (previous on-hand + received - current on-hand) / days, pooled over the supplied snapshots.
 * Assumes steady consumption and ignores deliveries still in transit. Intervals where stock rose without a recorded
 * receipt, or with no elapsed time, are skipped and counted rather than guessed at.
 * Alert: critical when days left <= lead time, warning when <= 2x lead time.
 */
export function forecastStock(points, opts) {
    const lead = opts.leadTimeDays ?? STOCK_DEFAULT_LEAD_TIME_DAYS;
    const sorted = [...points].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const latest = sorted[sorted.length - 1];
    if (!latest)
        return { level: 'insufficient_data', dailyConsumption: null, daysOfStockLeft: null, projectedStockoutOn: null, intervalsUsed: 0, inconsistentIntervals: 0, confidence: 'insufficient', stale: false };
    let consumed = 0;
    let days = 0;
    let intervalsUsed = 0;
    let inconsistentIntervals = 0;
    for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        const elapsed = (Date.parse(cur.observedAt) - Date.parse(prev.observedAt)) / DAY_MS;
        if (!(elapsed > 0))
            continue;
        const used = prev.quantityOnHand + cur.quantityReceived - cur.quantityOnHand;
        if (used < -1e-9) {
            inconsistentIntervals += 1;
            continue;
        }
        consumed += used;
        days += elapsed;
        intervalsUsed += 1;
    }
    const confidence = intervalsUsed >= 3 ? 'moderate' : intervalsUsed >= 1 ? 'low' : 'insufficient';
    const stale = (opts.now.getTime() - Date.parse(latest.observedAt)) / DAY_MS > STOCK_STALE_AFTER_DAYS;
    const dailyConsumption = days > 0 ? Math.round((consumed / days) * 100) / 100 : null;
    const base = { dailyConsumption, intervalsUsed, inconsistentIntervals, confidence, stale };
    if (stale)
        return { ...base, level: 'insufficient_data', daysOfStockLeft: null, projectedStockoutOn: null };
    if (latest.quantityOnHand === 0)
        return { ...base, level: 'critical', daysOfStockLeft: 0, projectedStockoutOn: latest.observedAt.slice(0, 10) };
    if (dailyConsumption === null)
        return { ...base, level: 'insufficient_data', daysOfStockLeft: null, projectedStockoutOn: null };
    if (dailyConsumption === 0)
        return { ...base, level: 'ok', daysOfStockLeft: null, projectedStockoutOn: null };
    const left = round1(latest.quantityOnHand / dailyConsumption);
    const out = new Date(Date.parse(latest.observedAt) + left * DAY_MS).toISOString().slice(0, 10);
    const level = left <= lead ? 'critical' : left <= lead * 2 ? 'warning' : 'ok';
    return { ...base, level, daysOfStockLeft: left, projectedStockoutOn: out };
}
export function buildSeriesForecast(series, opts) {
    const f = forecastStock(series.points, opts);
    const latest = [...series.points].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)).at(-1);
    const when = f.daysOfStockLeft === 0 ? 'Stock-out recorded' : `Projected stock-out in about ${f.daysOfStockLeft} days`;
    const suggestedSignal = f.level === 'critical'
        ? { category: 'service_disruption', summary: `${when} for commodity ${series.commodityCode} (${series.unit}) in area ${series.administrativeAreaCode}, based on recent stock snapshots.`, observedAt: latest.observedAt, location: { administrativeAreaCode: series.administrativeAreaCode, precision: 'facility' }, sourceType: 'facility_report' }
        : null;
    return { ...f, administrativeAreaCode: series.administrativeAreaCode, commodityCode: series.commodityCode, unit: series.unit, quantityOnHand: latest.quantityOnHand, lastObservedAt: latest.observedAt, suggestedSignal };
}
