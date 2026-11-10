export type ActionGapReason = { code: string; label: string; detail: string };
export type ActionGapCaseMetadata = { blockerType?: 'decision' | 'resource' | 'funding' | 'supplies' | 'authorization' | string; handoffAt?: string; handoffAcceptedAt?: string; handoffSlaDays?: number; resolvedAt?: string; reappearedAt?: string; recurrenceWindowDays?: number; matchingFacilityCount?: number };
export type ActionGapResult<T extends Record<string, unknown> = Record<string, unknown>> = T & {
  gapScore: number;
  gapLevel: 'urgent' | 'high' | 'watch' | 'clear';
  gapCount: number;
  gapReasons: ActionGapReason[];
  nextStep: string;
};
export function evaluateActionGaps<T extends Record<string, unknown>>(cases: T[], now?: number): ActionGapResult<T>[];
export const ACTION_GAP_RULES: Array<{ code: string; label: string; weight: number; detail: string }>;
