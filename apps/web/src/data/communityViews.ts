/** Parsers and checks for the community reports queue. No imports, so they can be unit-tested directly. */
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, f = ''): string => (typeof v === 'string' ? v : f);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

export interface QueueRow {
  id: string; channel: 'ussd' | 'sms'; category: string; areaCode: string; narrative: string | null; urgent: boolean; receivedAt: string;
  decision: 'promoted' | 'merged' | 'dismissed' | null; signalId: string | null;
}
export interface QueueStatsView { pending: number; urgentPending: number; oldestPendingHours: number | null; reviewedLast30Days: number; medianHoursToReview: number | null }

export const CATEGORY_LABEL: Record<string, string> = {
  unusual_illness: 'Unusual illness or deaths', water_sanitation: 'Water or sanitation problem', supply_gap: 'Medicine or supplies missing',
  animal_health: 'Sick or dead animals', other: 'Other health concern'
};
export const categoryLabel = (k: string): string => CATEGORY_LABEL[k] ?? k;

export function parseQueue(payload: unknown): QueueRow[] {
  if (!isRec(payload) || !Array.isArray(payload.items)) return [];
  const rows: QueueRow[] = [];
  for (const i of payload.items) {
    if (!isRec(i) || typeof i.id !== 'string') continue;
    const decision = i.decision === 'promoted' || i.decision === 'merged' || i.decision === 'dismissed' ? i.decision : null;
    rows.push({
      id: i.id, channel: i.channel === 'sms' ? 'sms' : 'ussd', category: str(i.category, 'other'), areaCode: str(i.areaCode),
      narrative: typeof i.narrative === 'string' ? i.narrative : null, urgent: i.urgent === true, receivedAt: str(i.receivedAt), decision,
      signalId: typeof i.signalId === 'string' ? i.signalId : null
    });
  }
  return rows;
}

export function parseStats(payload: unknown): QueueStatsView | null {
  if (!isRec(payload) || !isRec(payload.stats)) return null;
  const s = payload.stats;
  return { pending: count(s.pending), urgentPending: count(s.urgentPending), oldestPendingHours: numOrNull(s.oldestPendingHours), reviewedLast30Days: count(s.reviewedLast30Days), medianHoursToReview: numOrNull(s.medianHoursToReview) };
}

/** "3 h", "2 days 4 h": plain age text for a queue where waiting is the thing being watched. */
export function ageText(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return 'under 1 h';
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.floor(hours / 24)} days ${Math.round(hours % 24)} h`;
}

/** Mirrors the server's review schema; the server still has the final say (including the identifier check). */
export function validateReview(f: { decision: 'promote' | 'merge' | 'dismiss'; summary: string; signalId: string; reason: string }): string {
  if (f.decision === 'promote' && f.summary.trim() !== '' && (f.summary.trim().length < 10 || f.summary.trim().length > 1000)) return 'A summary needs 10 to 1000 characters, or leave it empty to use the standard one.';
  if (f.decision === 'merge' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(f.signalId.trim())) return 'Enter the ID of the existing signal (a long ID with dashes).';
  if (f.decision === 'merge' && f.reason.trim() !== '' && f.reason.trim().length < 3) return 'A reason needs at least 3 characters.';
  if (f.decision === 'dismiss' && (f.reason.trim().length < 3 || f.reason.trim().length > 500)) return 'Say why this is being dismissed (3 to 500 characters).';
  return '';
}

export function reviewErrorText(code: string): string {
  const map: Record<string, string> = {
    already_reviewed: 'Someone has already decided this report. Refresh the queue.', submission_not_found: 'That report was not found.',
    signal_not_found: 'No signal with that ID exists in this organisation.', insufficient_permissions: 'Your role does not allow reviewing community reports.',
    invalid_review: 'The server did not accept that decision. A summary must not contain names, phone numbers or ID numbers.',
    community_intake_not_configured: 'Community intake is not set up on this server.'
  };
  return map[code] ?? code;
}
