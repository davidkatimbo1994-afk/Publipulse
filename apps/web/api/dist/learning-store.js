export function canReadOperationalLearning(actor) {
    return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator', 'analyst', 'read_only', 'auditor'].includes(role));
}
export function canRecordWeeklyDecision(actor) {
    return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator'].includes(role));
}
