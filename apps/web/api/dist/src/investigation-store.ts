import type { InvestigationIntake, InvestigationUpdate } from '@publipulse/shared';
import type { VerifiedActor } from './signal-store.js';

export interface StoredInvestigation {
  id: string; organizationId: string; signalId: string; ownerUserId: string;
  status: 'open' | 'awaiting_information' | 'completed' | 'cancelled';
  findings: string | null; uncertaintyNote: string | null; version: number;
  openedAt: string; closedAt: string | null;
}
export type CreateInvestigationResult = { kind: 'created'; investigation: StoredInvestigation } | { kind: 'signal_not_found' } | { kind: 'invalid_owner' };
export type UpdateInvestigationResult = { kind: 'updated'; investigation: StoredInvestigation } | { kind: 'not_found' } | { kind: 'conflict' } | { kind: 'forbidden' };
export interface InvestigationStore {
  create(actor: VerifiedActor, signalId: string, input: InvestigationIntake): Promise<CreateInvestigationResult>;
  list(actor: VerifiedActor, signalId: string, limit: number): Promise<StoredInvestigation[] | null>;
  update(actor: VerifiedActor, investigationId: string, input: InvestigationUpdate): Promise<UpdateInvestigationResult>;
}
const managerRoles = ['owner', 'administrator', 'reviewer'];
export function canCreateInvestigation(actor: VerifiedActor): boolean {
  return actor.roles.some((role) => [...managerRoles, 'investigator'].includes(role));
}
export function canReadInvestigations(actor: VerifiedActor): boolean {
  return actor.roles.some((role) => [...managerRoles, 'investigator', 'responder', 'analyst', 'read_only'].includes(role));
}
export function canUpdateInvestigation(actor: VerifiedActor, ownerUserId?: string): boolean {
  return actor.roles.some((role) => managerRoles.includes(role) || (role === 'investigator' && (!ownerUserId || ownerUserId === actor.userId)));
}
