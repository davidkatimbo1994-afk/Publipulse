export function canManageHandoffs(actor) {
    return actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'responder', 'investigator'].includes(r));
}
