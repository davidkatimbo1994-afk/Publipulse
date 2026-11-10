import type { ActionGap, HealthSignal, ResponseAction, Severity } from './types';

export const SEVERITY_RANK: Record<Severity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

/** Signals that are still being worked (not closed), most severe and most recent first. */
export function openSignalsByPriority(signals: HealthSignal[]): HealthSignal[] {
  return signals
    .filter((s) => s.status !== 'Closed')
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.reportedAt.localeCompare(a.reportedAt));
}

/** Gaps needing attention: breached first, then warnings. */
export function gapsNeedingAttention(gaps: ActionGap[]): ActionGap[] {
  return gaps
    .filter((g) => g.status !== 'On Track')
    .sort((a, b) => (a.status === b.status ? b.elapsedHours - b.slaHours - (a.elapsedHours - a.slaHours) : a.status === 'Breached' ? -1 : 1));
}

export function hoursText(h: number): string {
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

/** Plain-language SLA position, e.g. "5.5 h over target" or "6 h left". */
export function slaPosition(gap: ActionGap): string {
  const diff = gap.elapsedHours - gap.slaHours;
  return diff > 0 ? `${hoursText(diff)} over target` : `${hoursText(-diff)} left`;
}

export function isActionOverdue(a: ResponseAction, today: string): boolean {
  return a.status !== 'Completed' && a.dueDate < today;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Tomorrow's date (UTC) as YYYY-MM-DD, for default due dates that must never be a stale hard-coded day. */
export function tomorrowIso(now: number = Date.now()): string {
  return new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Sends queued items one at a time and reports which were accepted. A failure keeps that item queued and moves on,
 * so one bad item cannot block the rest. `send` must be idempotent per item (the API de-duplicates on clientSubmissionId).
 */
export async function flushQueue<T>(pending: readonly T[], send: (item: T) => Promise<unknown>): Promise<{ sent: T[]; failed: T[] }> {
  const sent: T[] = [];
  const failed: T[] = [];
  for (const item of pending) {
    try {
      await send(item);
      sent.push(item);
    } catch {
      failed.push(item);
    }
  }
  return { sent, failed };
}
