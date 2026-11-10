import type { EvidenceIntake } from '@publipulse/shared';
import type { VerifiedActor } from './signal-store.js';

export interface StoredEvidence extends EvidenceIntake {
  id: string;
  organizationId: string;
  signalId: string;
  submittedBy: string;
  status: 'unreviewed' | 'supported' | 'contradictory' | 'rejected';
  createdAt: string;
}
export type CreateEvidenceResult = { kind: 'created'; evidence: StoredEvidence } | { kind: 'signal_not_found' };
export interface EvidenceStore {
  create(actor: VerifiedActor, signalId: string, input: EvidenceIntake): Promise<CreateEvidenceResult>;
  list(actor: VerifiedActor, signalId: string, limit: number): Promise<StoredEvidence[] | null>;
}
export function canManageEvidence(actor: VerifiedActor): boolean {
  return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator', 'analyst'].includes(role));
}
export function canReadEvidence(actor: VerifiedActor): boolean {
  return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only'].includes(role));
}
