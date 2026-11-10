import type { DecisionIntake, ResponseActionIntake, ResponseActionUpdate } from '@publipulse/shared';
import type { VerifiedActor } from './signal-store.js';

export interface StoredDecision {
  id: string; organizationId: string; signalId: string; investigationId: string | null; decidedBy: string;
  decision: DecisionIntake['decision']; rationale: string; evidenceSummary: string | null; createdAt: string;
}
export interface StoredResponseAction {
  id: string; organizationId: string; signalId: string; decisionId: string | null; title: string; description: string | null;
  ownerUserId: string; status: 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'; dueAt: string | null;
  completedAt: string | null; completionEvidence: string | null; createdBy: string; createdAt: string; updatedAt: string; version: number;
}
export type CreateDecisionResult = { kind: 'created'; decision: StoredDecision } | { kind: 'signal_not_found' } | { kind: 'investigation_not_found' };
export type CreateActionResult = { kind: 'created'; action: StoredResponseAction } | { kind: 'signal_not_found' } | { kind: 'decision_not_found' } | { kind: 'invalid_owner' };
export type UpdateActionResult = { kind: 'updated'; action: StoredResponseAction } | { kind: 'not_found' } | { kind: 'forbidden' } | { kind: 'conflict' };
export interface DecisionActionStore {
  createDecision(actor: VerifiedActor, signalId: string, input: DecisionIntake): Promise<CreateDecisionResult>;
  listDecisions(actor: VerifiedActor, signalId: string, limit: number): Promise<StoredDecision[] | null>;
  createAction(actor: VerifiedActor, signalId: string, input: ResponseActionIntake): Promise<CreateActionResult>;
  listActions(actor: VerifiedActor, signalId: string, limit: number): Promise<StoredResponseAction[] | null>;
  updateAction(actor: VerifiedActor, actionId: string, input: ResponseActionUpdate): Promise<UpdateActionResult>;
}
const managers = ['owner', 'administrator', 'reviewer'];
export const canManageDecisions = (actor: VerifiedActor) => actor.roles.some(r => managers.includes(r));
export const canReadDecisionsActions = (actor: VerifiedActor) => actor.roles.some(r => [...managers, 'investigator', 'responder', 'analyst', 'read_only'].includes(r));
export const canCreateResponseActions = (actor: VerifiedActor) => actor.roles.some(r => [...managers, 'responder'].includes(r));
