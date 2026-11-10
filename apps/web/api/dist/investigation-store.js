const managerRoles = ['owner', 'administrator', 'reviewer'];
export function canCreateInvestigation(actor) {
    return actor.roles.some((role) => [...managerRoles, 'investigator'].includes(role));
}
export function canReadInvestigations(actor) {
    return actor.roles.some((role) => [...managerRoles, 'investigator', 'responder', 'analyst', 'read_only'].includes(role));
}
export function canUpdateInvestigation(actor, ownerUserId) {
    return actor.roles.some((role) => managerRoles.includes(role) || (role === 'investigator' && (!ownerUserId || ownerUserId === actor.userId)));
}
