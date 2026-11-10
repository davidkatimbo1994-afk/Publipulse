export function canManageReporterFeedback(actor) { return actor.roles.some(r => ['owner', 'administrator', 'reviewer', 'investigator', 'responder'].includes(r)); }
