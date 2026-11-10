const managers = ['owner', 'administrator', 'reviewer'];
export const canManageDecisions = (actor) => actor.roles.some(r => managers.includes(r));
export const canReadDecisionsActions = (actor) => actor.roles.some(r => [...managers, 'investigator', 'responder', 'analyst', 'read_only'].includes(r));
export const canCreateResponseActions = (actor) => actor.roles.some(r => [...managers, 'responder'].includes(r));
