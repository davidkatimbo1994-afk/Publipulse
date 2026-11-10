export const canRecordActionCost = (actor) => actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'responder'].includes(r));
export const canReadActionCosts = (actor) => actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'responder', 'analyst', 'read_only', 'auditor'].includes(r));
