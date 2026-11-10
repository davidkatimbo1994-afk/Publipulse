import type { CommunityLimits, CommunityReview, CommunitySubmissionInput } from '@publipulse/shared';
import type { VerifiedActor } from './signal-store.js';

export type ReceiveResult =
  | { kind: 'accepted'; id: string }
  | { kind: 'duplicate' }
  | { kind: 'limited'; reason: 'cooldown' | 'organization_cap' | 'sender_hourly' | 'sender_daily' };

export interface QueueItem {
  id: string; channel: 'ussd' | 'sms'; category: string; areaCode: string; narrative: string | null; urgent: boolean; receivedAt: string;
  decision: 'promoted' | 'merged' | 'dismissed' | null; decidedAt: string | null; signalId: string | null;
}
export interface QueueStats { pending: number; urgentPending: number; oldestPendingAt: string | null; oldestPendingHours: number | null; reviewedLast30Days: number; medianHoursToReview: number | null }
export type ReviewResult =
  | { kind: 'reviewed'; decision: 'promoted' | 'merged' | 'dismissed'; signalId: string | null }
  | { kind: 'not_found' } | { kind: 'already_reviewed' } | { kind: 'signal_not_found' };

export interface CommunityIntakeStore {
  /** Applies the limits and, if the message is allowed, stores the submission, all in one transaction. */
  receive(organizationId: string, input: { senderHash: string; duplicateHash: string; submission: CommunitySubmissionInput }, now: Date, limits: CommunityLimits): Promise<ReceiveResult>;
  /** Counts a refused message (for example one that held a phone number) toward the sender's cooldown. Stores no content. */
  reject(organizationId: string, senderHash: string, now: Date, limits: CommunityLimits): Promise<void>;
  listQueue(actor: VerifiedActor, status: 'pending' | 'reviewed' | 'all', limit: number): Promise<QueueItem[]>;
  queueStats(actor: VerifiedActor, now: Date): Promise<QueueStats>;
  review(actor: VerifiedActor, submissionId: string, decision: CommunityReview, now: Date): Promise<ReviewResult>;
}
export const canReviewCommunityIntake = (actor: VerifiedActor): boolean => actor.roles.some((r) => r === 'owner' || r === 'administrator' || r === 'reviewer');
