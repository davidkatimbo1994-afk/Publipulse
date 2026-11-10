/** Who may manage whom. No imports, so the rules can be tested directly and used by both the API and the web app. */
export const MEMBER_ROLES = ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only', 'auditor'];
export const INVITATION_MAX_DAYS = 30;
export const INVITATION_DEFAULT_DAYS = 7;
const ADMINISTRATOR_ASSIGNABLE = ['reviewer', 'investigator', 'responder', 'analyst', 'read_only'];
export const isMemberRole = (v) => typeof v === 'string' && MEMBER_ROLES.includes(v);
/** Owners and administrators manage membership; nobody else does. */
export function canManageMembers(roles) {
    return roles.some((r) => r === 'owner' || r === 'administrator');
}
/**
 * Roles the actor may hand out (invite as, or change someone to).
 * Owners: every role. Administrators: operational roles only, so an administrator cannot create another administrator,
 * an owner or an auditor. Auditors are kept independent of day-to-day administration.
 */
export function assignableRoles(actorRoles) {
    if (actorRoles.includes('owner'))
        return [...MEMBER_ROLES];
    if (actorRoles.includes('administrator'))
        return [...ADMINISTRATOR_ASSIGNABLE];
    return [];
}
/** The actor must be allowed to manage the target's current role and, when the role changes, to assign the new one. */
export function decideMemberChange(actorRoles, targetCurrentRole, newRole) {
    if (!canManageMembers(actorRoles))
        return { allowed: false, reason: 'not_a_manager' };
    const assignable = assignableRoles(actorRoles);
    if (!assignable.includes(targetCurrentRole))
        return { allowed: false, reason: 'cannot_manage_target_role' };
    if (newRole !== undefined && !assignable.includes(newRole))
        return { allowed: false, reason: 'cannot_assign_role' };
    return { allowed: true };
}
/** True when the change would leave the organisation without an active owner. `otherActiveOwners` excludes the target. */
export function wouldRemoveLastOwner(target, change, otherActiveOwners) {
    if (target.role !== 'owner' || !target.active)
        return false;
    const staysOwner = (change.role ?? target.role) === 'owner';
    const staysActive = change.active ?? target.active;
    return (!staysOwner || !staysActive) && otherActiveOwners < 1;
}
export function invitationStatus(row, now) {
    if (row.redeemedAt)
        return 'redeemed';
    if (row.revokedAt)
        return 'revoked';
    return Date.parse(row.expiresAt) <= now.getTime() ? 'expired' : 'pending';
}
/** Invitation codes look like `ppi_` followed by 43 URL-safe characters (256 bits). */
export const INVITATION_CODE_PATTERN = /^ppi_[A-Za-z0-9_-]{43}$/;
