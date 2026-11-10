export const GAP_RULES = ['UNVERIFIED', 'NO_OWNER', 'OVERDUE', 'BLOCKED', 'NO_EVIDENCE', 'REPEATED', 'LOW_CONFIDENCE', 'RESOURCE_DECISION_MISSING', 'HANDOFF_STALLED', 'RECENTLY_REOPENED', 'CROSS_FACILITY_PATTERN'];
const managers = ['owner', 'administrator', 'reviewer'];
export const canCreateGap = (a) => a.roles.some(r => [...managers, 'investigator', 'analyst'].includes(r));
export const canReadGaps = (a) => a.roles.some(r => [...managers, 'investigator', 'responder', 'analyst', 'read_only', 'auditor'].includes(r));
export const canReviewGaps = (a) => a.roles.some(r => managers.includes(r));
