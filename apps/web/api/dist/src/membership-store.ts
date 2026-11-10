import type { InvitationStatus, MemberRole } from '@publipulse/shared';
import type { VerifiedActor } from './signal-store.js';

export interface StoredMember { userId: string; role: MemberRole; active: boolean; createdAt: string; updatedAt: string }
export interface StoredInvitation {
  id: string; role: MemberRole; status: InvitationStatus; createdBy: string | null; createdAt: string; expiresAt: string;
  redeemedAt: string | null; revokedAt: string | null;
}
export type ChangeMemberResult =
  | { kind: 'updated'; member: StoredMember }
  | { kind: 'not_found' }
  | { kind: 'forbidden'; reason: 'not_a_manager' | 'cannot_manage_target_role' | 'cannot_assign_role' }
  | { kind: 'last_owner' };
export type RevokeInvitationResult = 'revoked' | 'not_found' | 'not_pending';
export type RedeemInvitationResult = { kind: 'joined'; role: MemberRole } | { kind: 'invalid' } | { kind: 'already_member' };

export interface MembershipStore {
  listMembers(actor: VerifiedActor, limit: number): Promise<StoredMember[]>;
  changeMember(actor: VerifiedActor, targetUserId: string, change: { role?: MemberRole; active?: boolean }): Promise<ChangeMemberResult>;
  /** Returns the one-time code. Only its hash is stored, so it cannot be shown again. */
  createInvitation(actor: VerifiedActor, role: MemberRole, expiresInDays: number, now: Date): Promise<{ invitation: StoredInvitation; code: string }>;
  listInvitations(actor: VerifiedActor, limit: number, now: Date): Promise<StoredInvitation[]>;
  revokeInvitation(actor: VerifiedActor, invitationId: string): Promise<RevokeInvitationResult>;
  /** The caller has verified the token, not a membership: the person is not a member yet. */
  redeemInvitation(organizationId: string, userId: string, code: string, now: Date): Promise<RedeemInvitationResult>;
}
export { canManageMembers } from '@publipulse/shared';
