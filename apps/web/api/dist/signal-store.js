export function canSubmitSignals(actor) {
    return actor.roles.some((role) => ['owner', 'administrator', 'reviewer', 'investigator', 'responder'].includes(role));
}
const TRANSITIONS = {
    submitted: ['under_review', 'dismissed'],
    under_review: ['investigating', 'verified', 'dismissed'],
    investigating: ['under_review', 'verified', 'dismissed'],
    verified: ['closed'],
    dismissed: ['closed'],
    closed: []
};
export function canTransitionSignal(actor, nextStatus) {
    const requiredRoles = {
        submitted: [],
        under_review: ['owner', 'administrator', 'reviewer'],
        investigating: ['owner', 'administrator', 'reviewer', 'investigator'],
        verified: ['owner', 'administrator', 'reviewer'],
        dismissed: ['owner', 'administrator', 'reviewer'],
        closed: ['owner', 'administrator', 'reviewer']
    };
    return requiredRoles[nextStatus].some((role) => actor.roles.includes(role));
}
export function isAllowedSignalTransition(current, next) {
    return TRANSITIONS[current].includes(next);
}
