/** Defensive parsers that turn API payloads (unknown JSON) into chart-ready shapes.
 *  A malformed or partial payload yields null / skipped rows, never a thrown error in the UI.
 */
type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const hours = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/** Accepts either the summary itself or the full response body that wraps it as `summary`. */
const unwrap = (payload: unknown): Rec | null => (isRec(payload) ? (isRec(payload.summary) ? payload.summary : payload) : null);

export const FUNNEL_STAGES = ['Signals', 'Verified', 'Owner assigned', 'Action taken', 'Outcome measured', 'Result held'] as const;

export interface DistrictWeek {
  code: string; stages: number[]; unresolved: number; recurrences: number; blockers: number;
  priority: 'critical' | 'high' | 'routine';
}
export interface WeeklyReviewData {
  weekStart: string; weekEnd: string; minCell: number; districts: DistrictWeek[]; decisionsNeeded: string[]; interpretation: string;
}

export function parseWeeklyReview(payload: unknown): WeeklyReviewData | null {
  const s = unwrap(payload);
  if (!s || !Array.isArray(s.districts)) return null;
  const districts: DistrictWeek[] = [];
  for (const d of s.districts) {
    if (!isRec(d) || typeof d.administrativeAreaCode !== 'string') continue;
    const priority = d.priority === 'critical' || d.priority === 'high' ? d.priority : 'routine';
    districts.push({
      code: d.administrativeAreaCode,
      stages: [d.signalCount, d.verifiedCount, d.ownedCount, d.actedCount, d.measuredCount, d.durableCount].map(count),
      unresolved: count(d.unresolvedCount), recurrences: count(d.recurrenceCount), blockers: count(d.blockerCount), priority
    });
  }
  return {
    weekStart: typeof s.weekStart === 'string' ? s.weekStart : '', weekEnd: typeof s.weekEnd === 'string' ? s.weekEnd : '',
    minCell: count(s.minCell), districts,
    decisionsNeeded: Array.isArray(s.decisionsNeeded) ? s.decisionsNeeded.filter((x): x is string => typeof x === 'string') : [],
    interpretation: typeof s.interpretation === 'string' ? s.interpretation : ''
  };
}

/** Reference targets of the 7-1-7 rule that the API clocks map onto: notify within 1 day, respond within 7 days. */
export const NOTIFY_TARGET_HOURS = 24;
export const RESPOND_TARGET_HOURS = 168;

export interface SevenOneSevenData {
  signalCount: number; notifiedCount: number; responseStartedCount: number; measuredOutcomeCount: number;
  detectionToNotification: number | null; notificationToResponse: number | null;
  detectionToResponse: number | null; detectionToMeasuredOutcome: number | null; interpretation: string;
}

export function parseSevenOneSeven(payload: unknown): SevenOneSevenData | null {
  const s = unwrap(payload);
  if (!s || !isRec(s.medianHours)) return null;
  const m = s.medianHours;
  return {
    signalCount: count(s.signalCount), notifiedCount: count(s.notifiedCount),
    responseStartedCount: count(s.responseStartedCount), measuredOutcomeCount: count(s.measuredOutcomeCount),
    detectionToNotification: hours(m.detectionToNotification), notificationToResponse: hours(m.notificationToResponse),
    detectionToResponse: hours(m.detectionToResponse), detectionToMeasuredOutcome: hours(m.detectionToMeasuredOutcome),
    interpretation: typeof s.interpretation === 'string' ? s.interpretation : ''
  };
}
