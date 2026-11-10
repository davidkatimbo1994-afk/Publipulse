import type { ActionGap, HealthSignal, Severity } from './types';

export interface BarRow { label: string; value: number; tone: 'critical' | 'high' | 'medium' | 'low' | 'neutral' }

const TONE: Record<Severity, BarRow['tone']> = { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' };
const ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

/** Open (not closed) signals counted per severity, most severe first. Always returns all four levels. */
export function openSignalsBySeverity(signals: readonly HealthSignal[]): BarRow[] {
  return ORDER.map((level) => ({
    label: level,
    value: signals.filter((s) => s.status !== 'Closed' && s.severity === level).length,
    tone: TONE[level]
  }));
}

/** Reported suspected cases per disease across all signals, largest first. */
export function casesByDisease(signals: readonly HealthSignal[]): BarRow[] {
  const totals = new Map<string, number>();
  for (const s of signals) totals.set(s.disease, (totals.get(s.disease) ?? 0) + s.cases);
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, tone: 'neutral' as const }));
}

export interface SlaRow { id: string; label: string; area: string; target: number; elapsed: number; status: ActionGap['status'] }

export function slaRows(gaps: readonly ActionGap[]): SlaRow[] {
  return gaps
    .map((g) => ({ id: g.id, label: g.title, area: g.area, target: g.slaHours, elapsed: g.elapsedHours, status: g.status }))
    .sort((a, b) => b.elapsed / Math.max(b.target, 1) - a.elapsed / Math.max(a.target, 1));
}

/** Round an axis maximum up to a readable step (1, 2, 5 × 10^n), so ticks land on clean numbers. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / pow;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Whole-number axis ticks from 0 to `top` (a niceMax value). Counts are whole numbers, so ticks like 1.25 cases are never drawn,
 * and every tick sits exactly where its label says.
 */
export function axisTicks(top: number): number[] {
  const max = Math.max(1, Math.round(top));
  const step = max <= 5 ? 1 : max % 5 === 0 ? max / 5 : Math.ceil(max / 4);
  const ticks: number[] = [];
  for (let t = 0; t < max; t += step) ticks.push(t);
  ticks.push(max);
  return ticks;
}
