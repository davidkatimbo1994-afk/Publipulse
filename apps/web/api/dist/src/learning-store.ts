import type { VerifiedActor } from './signal-store.js';
import type { WeeklyReviewSummary } from '@publipulse/shared/weekly-review';
import type { PilotEvidenceRecordInput } from '@publipulse/shared/pilot-evidence';
import type { WeeklyDecisionInput } from '@publipulse/shared/weekly-decision';

export interface LearningPattern {
  dimension: 'category' | 'administrative_area';
  key: string;
  signalCount: number;
  verifiedCount: number;
  completedActionCount: number;
  outcomeCount: number;
  improvedOutcomeCount: number;
  inconclusiveOutcomeCount: number;
  openGapCount: number;
}

export interface LearningSummary {
  from: string;
  to: string;
  minCell: number;
  overall: Omit<LearningPattern, 'dimension' | 'key'>;
  patterns: LearningPattern[];
}

export interface SevenOneSevenSummary {
  from: string; to: string; signalCount: number; notifiedCount: number; responseStartedCount: number; measuredOutcomeCount: number;
  medianHours: { detectionToNotification: number|null; notificationToResponse: number|null; detectionToResponse: number|null; detectionToMeasuredOutcome: number|null };
  interpretation: string;
}

export interface OutcomeDecaySummary {
  from: string;
  to: string;
  minCell: number;
  funnel: { signal: number; verified: number; owned: number; acted: number; measured: number; durable: number; pendingDurability: number };
  completeness: { verified: number; owned: number; acted: number; measured: number; durable: number };
  medianHours: { verified: number | null; owned: number | null; acted: number | null; measured: number | null; durable: number | null };
  dropoutReasons: Array<{ code: string; count: number }>;
  blockers: Array<{ type: string; count: number }>;
  interpretation: string;
}

export interface PersistentProblemQueueItem {
  patternId: string;
  category: string;
  administrativeAreaCode: string;
  occurrenceCount: number;
  unresolvedCount: number;
  recurrenceAfterActionCount: number;
  distinctInterventionFamilies: number;
  classification: string;
  lastObservedAt: string;
}

export interface LearningStore {
  operationalPatterns(actor: VerifiedActor, from: Date, to: Date, minCell: number): Promise<LearningSummary>;
  outcomeDecay(actor: VerifiedActor, from: Date, to: Date, minCell: number): Promise<OutcomeDecaySummary>;
  sevenOneSeven(actor: VerifiedActor, from: Date, to: Date, minCell: number): Promise<SevenOneSevenSummary>;
  persistentProblemQueue(actor: VerifiedActor, minCell: number): Promise<PersistentProblemQueueItem[]>;
  weeklyReview(actor: VerifiedActor, weekStart: Date, weekEnd: Date, minCell: number): Promise<WeeklyReviewSummary>;
  recordPilotEvidence(actor: VerifiedActor, input: PilotEvidenceRecordInput): Promise<{ id: string; recordedAt: string; comparisonSnapshot: unknown }>;
  recordWeeklyDecision(actor: VerifiedActor, input: WeeklyDecisionInput): Promise<{ id: string; recordedAt: string }>;
}

export function canReadOperationalLearning(actor: VerifiedActor): boolean {
  return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator', 'analyst', 'read_only', 'auditor'].includes(role));
}

export function canRecordWeeklyDecision(actor: VerifiedActor): boolean {
  return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator'].includes(role));
}
