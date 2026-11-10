export function canReadInteroperability(actor) {
    return actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only', 'auditor'].includes(r));
}
export function canManageSharingPolicy(actor) {
    return actor.roles.some(r => ['owner', 'administrator'].includes(r));
}
