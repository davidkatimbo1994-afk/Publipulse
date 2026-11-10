/** Who may manage whom. No imports, so the rules can be tested directly and used by both the API and the web app. */
export declare const MEMBER_ROLES: readonly ["owner", "administrator", "reviewer", "investigator", "responder", "analyst", "read_only", "auditor"];
export type MemberRole = (typeof MEMBER_ROLES)[number];
export declare const INVITATION_MAX_DAYS = 30;
export declare const INVITATION_DEFAULT_DAYS = 7;
export declare const isMemberRole: (v: unknown) => v is MemberRole;
/** Owners and administrators manage membership; nobody else does. */
export declare function canManageMembers(roles: ReadonlyArray<string>): boolean;
/**
 * Roles the actor may hand out (invite as, or change someone to).
 * Owners: every role. Administrators: operational roles only, so an administrator cannot create another administrator,
 * an owner or an auditor. Auditors are kept independent of day-to-day administration.
 */
export declare function assignableRoles(actorRoles: ReadonlyArray<string>): MemberRole[];
export type MemberChangeDecision = {
    allowed: true;
} | {
    allowed: false;
    reason: 'not_a_manager' | 'cannot_manage_target_role' | 'cannot_assign_role';
};
/** The actor must be allowed to manage the target's current role and, when the role changes, to assign the new one. */
export declare function decideMemberChange(actorRoles: ReadonlyArray<string>, targetCurrentRole: string, newRole?: string): MemberChangeDecision;
/** True when the change would leave the organisation without an active owner. `otherActiveOwners` excludes the target. */
export declare function wouldRemoveLastOwner(target: {
    role: string;
    active: boolean;
}, change: {
    role?: string;
    active?: boolean;
}, otherActiveOwners: number): boolean;
export type InvitationStatus = 'pending' | 'redeemed' | 'revoked' | 'expired';
export declare function invitationStatus(row: {
    redeemedAt: string | null;
    revokedAt: string | null;
    expiresAt: string;
}, now: Date): InvitationStatus;
/** Invitation codes look like `ppi_` followed by 43 URL-safe characters (256 bits). */
export declare const INVITATION_CODE_PATTERN: RegExp;
