import { z } from 'zod';
const isRealDate = (v) => { const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; };
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate, { message: 'must be a real calendar date' });
/** Area-level environmental or socio-economic context with provenance. Aggregates only; never person-level data. */
export const ExternalContextObservationSchema = z.object({
    administrativeAreaCode: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._-]+$/),
    metricCode: z.string().trim().min(1).max(80).regex(/^[a-z0-9_.-]+$/),
    value: z.number().finite().gt(-1e12).lt(1e12),
    unit: z.string().trim().min(1).max(40),
    periodStart: DATE,
    periodEnd: DATE,
    sourceLabel: z.string().trim().min(1).max(240),
    sourceUri: z.string().url().max(2048).refine((v) => { try {
        const u = new URL(v);
        return u.protocol === 'https:' && !u.username && !u.password;
    }
    catch {
        return false;
    } }, 'source URI must be HTTPS without embedded credentials').optional()
}).strict().superRefine((v, ctx) => {
    const a = Date.parse(`${v.periodStart}T00:00:00Z`);
    const b = Date.parse(`${v.periodEnd}T00:00:00Z`);
    if (Number.isNaN(a) || Number.isNaN(b))
        return;
    if (a > b)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodEnd'], message: 'periodEnd must not be before periodStart' });
    else if ((b - a) / 86_400_000 > 31)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodEnd'], message: 'period must span at most 31 days' });
});
export const CONTEXT_WINDOW_DAYS_BEFORE = 28;
export const CONTEXT_WINDOW_DAYS_AFTER = 7;
export const CONTEXT_MIN_BASELINE = 3;
export const CONTEXT_SIMILAR_BAND = 0.2;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const r2 = (v) => Math.round(v * 100) / 100;
/**
 * Compares each metric's mean around a signal with its mean over earlier periods of the same area and unit.
 * This describes association in time only. It never asserts cause, and needs at least three baseline periods.
 */
export function compareContextToBaseline(windowValues, baselineValues) {
    const key = (v) => `${v.metricCode}\u0000${v.unit}`;
    const win = new Map();
    const base = new Map();
    for (const v of windowValues)
        win.set(key(v), [...(win.get(key(v)) ?? []), v]);
    for (const v of baselineValues)
        base.set(key(v), [...(base.get(key(v)) ?? []), v.value]);
    return [...win.entries()].map(([k, vs]) => {
        const first = vs[0];
        const b = base.get(k) ?? [];
        const windowMean = r2(mean(vs.map((x) => x.value)));
        if (b.length < CONTEXT_MIN_BASELINE)
            return { metricCode: first.metricCode, unit: first.unit, windowMean, windowCount: vs.length, baselineMean: b.length ? r2(mean(b)) : null, baselineCount: b.length, ratio: null, deviation: 'insufficient_baseline' };
        const baselineMean = mean(b);
        const ratio = baselineMean === 0 ? null : windowMean / baselineMean;
        const deviation = ratio === null ? 'insufficient_baseline' : ratio > 1 + CONTEXT_SIMILAR_BAND ? 'above' : ratio < 1 - CONTEXT_SIMILAR_BAND ? 'below' : 'similar';
        return { metricCode: first.metricCode, unit: first.unit, windowMean, windowCount: vs.length, baselineMean: r2(baselineMean), baselineCount: b.length, ratio: ratio === null ? null : r2(ratio), deviation };
    }).sort((x, y) => x.metricCode.localeCompare(y.metricCode) || x.unit.localeCompare(y.unit));
}
/** The date range of context examined around a signal's observed time (UTC dates). */
export function contextWindowFor(observedAt) {
    const t = Date.parse(observedAt);
    const day = (ms) => new Date(ms).toISOString().slice(0, 10);
    return { from: day(t - CONTEXT_WINDOW_DAYS_BEFORE * 86_400_000), to: day(t + CONTEXT_WINDOW_DAYS_AFTER * 86_400_000) };
}
