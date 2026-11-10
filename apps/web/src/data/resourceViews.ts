/** Defensive parsers for the cost, stock and context endpoints.
 *  A malformed or partial payload yields skipped rows or null, never a thrown error in the UI.
 *  No imports, so the file can be unit-tested directly.
 */
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** 1234.5 -> "1,234.50 KES". Amounts of different currencies are never added together. */
export function money(amount: number, currencyCode: string): string {
  return `${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`;
}

/* ---------------------------------------------------------------- costs */

export interface CostTotal { currencyCode: string; costKind: 'planned' | 'actual'; amount: number }
export interface CostSummaryRow {
  actionId: string; signalId: string; title: string; totals: CostTotal[];
  outcomes: { improved: number; no_change: number; worsened: number; inconclusive: number };
  costPerImproved: Array<{ currencyCode: string; amount: number }>;
}
export interface CostEntryRow {
  id: string; costKind: 'planned' | 'actual'; costCategory: string; amount: number; currencyCode: string; incurredOn: string; note: string;
}

function parseTotals(v: unknown): CostTotal[] {
  if (!Array.isArray(v)) return [];
  const out: CostTotal[] = [];
  for (const t of v) {
    if (!isRec(t)) continue;
    const amount = num(t.amount);
    const kind = t.costKind === 'planned' || t.costKind === 'actual' ? t.costKind : null;
    if (amount === null || kind === null || typeof t.currencyCode !== 'string') continue;
    out.push({ currencyCode: t.currencyCode, costKind: kind, amount });
  }
  return out;
}

export function parseCostSummary(payload: unknown): CostSummaryRow[] {
  if (!isRec(payload) || !Array.isArray(payload.actions)) return [];
  const rows: CostSummaryRow[] = [];
  for (const a of payload.actions) {
    if (!isRec(a) || typeof a.actionId !== 'string') continue;
    const o = isRec(a.outcomes) ? a.outcomes : {};
    const per: Array<{ currencyCode: string; amount: number }> = [];
    if (Array.isArray(a.costPerImprovedAssessment)) {
      for (const p of a.costPerImprovedAssessment) {
        if (isRec(p) && typeof p.currencyCode === 'string' && num(p.amount) !== null) per.push({ currencyCode: p.currencyCode, amount: p.amount as number });
      }
    }
    rows.push({
      actionId: a.actionId, signalId: str(a.signalId), title: str(a.title, 'Untitled action'), totals: parseTotals(a.totals),
      outcomes: { improved: count(o.improved), no_change: count(o.no_change), worsened: count(o.worsened), inconclusive: count(o.inconclusive) },
      costPerImproved: per
    });
  }
  return rows;
}

export interface ActionCostsData { entries: CostEntryRow[]; totals: CostTotal[] }

export function parseActionCosts(payload: unknown): ActionCostsData {
  if (!isRec(payload)) return { entries: [], totals: [] };
  const entries: CostEntryRow[] = [];
  if (Array.isArray(payload.entries)) {
    for (const e of payload.entries) {
      if (!isRec(e) || typeof e.id !== 'string') continue;
      const amount = num(e.amount);
      const kind = e.costKind === 'planned' || e.costKind === 'actual' ? e.costKind : null;
      if (amount === null || kind === null) continue;
      entries.push({ id: e.id, costKind: kind, costCategory: str(e.costCategory, 'other'), amount, currencyCode: str(e.currencyCode), incurredOn: str(e.incurredOn), note: str(e.note) });
    }
  }
  return { entries, totals: parseTotals(payload.totals) };
}

/** Validation that mirrors ActionCostEntrySchema, so a typo is explained before the request is sent. */
export function validateCostForm(f: { amount: string; currencyCode: string; incurredOn: string; note: string }, today: string): string {
  const amount = Number(f.amount);
  if (f.amount.trim() === '' || !Number.isFinite(amount) || amount < 0) return 'Enter an amount of zero or more.';
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return 'Use at most two decimal places.';
  if (amount > 100_000_000_000) return 'That amount is too large.';
  if (!/^[A-Z]{3}$/.test(f.currencyCode.trim())) return 'Use a three-letter currency code, for example KES.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.incurredOn) || Number.isNaN(Date.parse(`${f.incurredOn}T00:00:00Z`)) || new Date(`${f.incurredOn}T00:00:00Z`).toISOString().slice(0, 10) !== f.incurredOn) return 'Enter a real date.';
  if (f.incurredOn > today) return 'The cost date cannot be in the future.';
  if (f.note.trim() !== '' && (f.note.trim().length < 3 || f.note.trim().length > 500)) return 'A note needs 3 to 500 characters, or leave it empty.';
  return '';
}

/* ---------------------------------------------------------------- stock */

export type StockLevel = 'critical' | 'warning' | 'ok' | 'insufficient_data';
export interface StockSeriesRow {
  areaCode: string; commodityCode: string; unit: string; quantityOnHand: number; lastObservedAt: string;
  level: StockLevel; dailyConsumption: number | null; daysOfStockLeft: number | null; projectedStockoutOn: string | null;
  intervalsUsed: number; inconsistentIntervals: number; confidence: 'insufficient' | 'low' | 'moderate'; stale: boolean;
  draftSummary: string | null;
}
export interface StockForecastData { series: StockSeriesRow[]; leadTimeDays: number | null }

const LEVEL_ORDER: Record<StockLevel, number> = { critical: 0, warning: 1, insufficient_data: 2, ok: 3 };
export const LEVEL_LABEL: Record<StockLevel, string> = { critical: 'Critical', warning: 'Warning', ok: 'OK', insufficient_data: 'Not enough data' };

export function parseStockForecast(payload: unknown): StockForecastData {
  if (!isRec(payload) || !Array.isArray(payload.series)) return { series: [], leadTimeDays: null };
  const series: StockSeriesRow[] = [];
  for (const s of payload.series) {
    if (!isRec(s) || typeof s.administrativeAreaCode !== 'string' || typeof s.commodityCode !== 'string') continue;
    const level: StockLevel = s.level === 'critical' || s.level === 'warning' || s.level === 'ok' ? s.level : 'insufficient_data';
    const conf = s.confidence === 'low' || s.confidence === 'moderate' ? s.confidence : 'insufficient';
    const draft = isRec(s.suggestedSignal) && typeof s.suggestedSignal.summary === 'string' ? s.suggestedSignal.summary : null;
    series.push({
      areaCode: s.administrativeAreaCode, commodityCode: s.commodityCode, unit: str(s.unit), quantityOnHand: num(s.quantityOnHand) ?? 0,
      lastObservedAt: str(s.lastObservedAt), level, dailyConsumption: num(s.dailyConsumption), daysOfStockLeft: num(s.daysOfStockLeft),
      projectedStockoutOn: typeof s.projectedStockoutOn === 'string' ? s.projectedStockoutOn : null,
      intervalsUsed: count(s.intervalsUsed), inconsistentIntervals: count(s.inconsistentIntervals), confidence: conf, stale: s.stale === true, draftSummary: draft
    });
  }
  series.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || (a.daysOfStockLeft ?? Infinity) - (b.daysOfStockLeft ?? Infinity) || a.areaCode.localeCompare(b.areaCode) || a.commodityCode.localeCompare(b.commodityCode));
  const lead = isRec(payload.assumptions) ? num(payload.assumptions.leadTimeDays) : null;
  return { series, leadTimeDays: lead };
}

export function stockLevelCounts(series: ReadonlyArray<Pick<StockSeriesRow, 'level'>>): Record<StockLevel, number> {
  const c: Record<StockLevel, number> = { critical: 0, warning: 0, ok: 0, insufficient_data: 0 };
  for (const s of series) c[s.level] += 1;
  return c;
}

/** Mirrors StockSnapshotSchema. `observedAt` is a datetime-local value ("2026-11-05T09:30"), converted to an ISO instant. */
export function validateStockForm(f: { areaCode: string; commodityCode: string; unit: string; onHand: string; received: string; observedAt: string }, now: Date): string {
  const code = /^[A-Za-z0-9._-]{1,80}$/;
  if (!code.test(f.areaCode.trim())) return 'Area code: letters, numbers, dot, dash or underscore only (max 80).';
  if (!code.test(f.commodityCode.trim())) return 'Commodity code: letters, numbers, dot, dash or underscore only (max 80).';
  if (f.unit.trim() === '' || f.unit.trim().length > 40) return 'Enter a unit of up to 40 characters, for example "doses".';
  for (const [label, raw] of [['Quantity on hand', f.onHand], ['Quantity received', f.received]] as const) {
    if (raw.trim() === '') { if (label === 'Quantity received') continue; return `${label} is required.`; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000_000) return `${label} must be zero or more.`;
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return `${label}: use at most two decimal places.`;
  }
  const t = Date.parse(f.observedAt);
  if (Number.isNaN(t)) return 'Enter the date and time of the stock count.';
  if (t > now.getTime() + 5 * 60_000) return 'The stock count time cannot be in the future.';
  return '';
}

/* -------------------------------------------------------------- context */

export interface ContextComparisonRow {
  metricCode: string; unit: string; windowMean: number; windowCount: number; baselineMean: number | null; baselineCount: number;
  ratio: number | null; deviation: 'above' | 'below' | 'similar' | 'insufficient_baseline';
}
export interface ContextObservationRow {
  id: string; areaCode: string; metricCode: string; value: number; unit: string; periodStart: string; periodEnd: string; sourceLabel: string; sourceUri: string | null;
}
export interface SignalContextData {
  signalId: string; areaCode: string; from: string; to: string; comparisons: ContextComparisonRow[]; observations: ContextObservationRow[];
  associationOnly: boolean;
}

function parseObservation(o: unknown): ContextObservationRow | null {
  if (!isRec(o) || typeof o.id !== 'string' || typeof o.metricCode !== 'string') return null;
  const value = num(o.value);
  if (value === null) return null;
  return {
    id: o.id, areaCode: str(o.administrativeAreaCode), metricCode: o.metricCode, value, unit: str(o.unit), periodStart: str(o.periodStart), periodEnd: str(o.periodEnd),
    sourceLabel: str(o.sourceLabel, 'Source not stated'), sourceUri: typeof o.sourceUri === 'string' && /^https:\/\//i.test(o.sourceUri) ? o.sourceUri : null
  };
}

export function parseContextObservations(payload: unknown): ContextObservationRow[] {
  if (!isRec(payload) || !Array.isArray(payload.observations)) return [];
  return payload.observations.map(parseObservation).filter((x): x is ContextObservationRow => x !== null);
}

export function parseSignalContext(payload: unknown): SignalContextData | null {
  if (!isRec(payload) || typeof payload.signalId !== 'string' || !isRec(payload.window)) return null;
  const comparisons: ContextComparisonRow[] = [];
  if (Array.isArray(payload.comparisons)) {
    for (const c of payload.comparisons) {
      if (!isRec(c) || typeof c.metricCode !== 'string') continue;
      const dev = c.deviation === 'above' || c.deviation === 'below' || c.deviation === 'similar' ? c.deviation : 'insufficient_baseline';
      comparisons.push({
        metricCode: c.metricCode, unit: str(c.unit), windowMean: num(c.windowMean) ?? 0, windowCount: count(c.windowCount), baselineMean: num(c.baselineMean),
        baselineCount: count(c.baselineCount), ratio: num(c.ratio), deviation: dev
      });
    }
  }
  return {
    signalId: payload.signalId, areaCode: str(payload.administrativeAreaCode), from: str(payload.window.from), to: str(payload.window.to),
    comparisons, observations: parseContextObservations(payload), associationOnly: payload.interpretation === 'association_in_time_only' && payload.causalClaim === false
  };
}

export const DEVIATION_LABEL: Record<ContextComparisonRow['deviation'], string> = {
  above: 'Above usual', below: 'Below usual', similar: 'Similar to usual', insufficient_baseline: 'Not enough earlier data'
};

/** Mirrors ExternalContextObservationSchema. */
export function validateContextForm(f: { areaCode: string; metricCode: string; value: string; unit: string; periodStart: string; periodEnd: string; sourceLabel: string; sourceUri: string }): string {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(f.areaCode.trim())) return 'Area code: letters, numbers, dot, dash or underscore only (max 80).';
  if (!/^[a-z0-9_.-]{1,80}$/.test(f.metricCode.trim())) return 'Metric code: lower-case letters, numbers, dot, dash or underscore only, for example rainfall_mm.';
  const v = Number(f.value);
  if (f.value.trim() === '' || !Number.isFinite(v) || Math.abs(v) >= 1e12) return 'Enter the measured value as a number.';
  if (f.unit.trim() === '' || f.unit.trim().length > 40) return 'Enter a unit of up to 40 characters.';
  const real = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
  if (!real(f.periodStart) || !real(f.periodEnd)) return 'Enter real start and end dates.';
  if (f.periodEnd < f.periodStart) return 'The period end cannot be before its start.';
  if ((Date.parse(`${f.periodEnd}T00:00:00Z`) - Date.parse(`${f.periodStart}T00:00:00Z`)) / 86_400_000 > 31) return 'A period can span at most 31 days.';
  if (f.sourceLabel.trim() === '' || f.sourceLabel.trim().length > 240) return 'Name the source (up to 240 characters).';
  if (f.sourceUri.trim() !== '') {
    try { const u = new URL(f.sourceUri.trim()); if (u.protocol !== 'https:' || u.username || u.password) return 'The source link must be https without a login in it.'; }
    catch { return 'The source link is not a valid web address.'; }
  }
  return '';
}
