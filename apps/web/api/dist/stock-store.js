export const canRecordStock = (actor) => actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'responder'].includes(r));
export const canReadStock = (actor) => actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'responder', 'analyst', 'read_only', 'auditor'].includes(r));
