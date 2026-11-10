export const canRecordContext = (actor) => actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'analyst'].includes(r));
export const canReadContext = (actor) => actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'responder', 'analyst', 'read_only', 'auditor'].includes(r));
