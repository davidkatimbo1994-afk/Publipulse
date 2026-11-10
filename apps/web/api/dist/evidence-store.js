export function canManageEvidence(actor) {
    return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator', 'analyst'].includes(role));
}
export function canReadEvidence(actor) {
    return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only'].includes(role));
}
