export const canCreateOutcomeAssessment = (actor) => actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst'].includes(r));
export const canReadOutcomeAssessments = (actor) => actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only', 'auditor'].includes(r));
