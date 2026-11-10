import { evaluateWorkflowCase } from './evaluator.js';
/** Stable identity for one rule finding on one signal/workflow case. */
export function actionGapFingerprint(finding) {
    const caseId = typeof finding.supportingEvidence.workflowCaseId === 'string' ? finding.supportingEvidence.workflowCaseId : 'signal';
    return [finding.signalId, caseId, finding.ruleCode, finding.ruleVersion].join(':');
}
/** Pure planner only. Persistence adapters must apply this plan in an organization-scoped transaction and audit updates. */
export function planActionGapReconciliation(cases, existing, now = Date.now()) {
    const current = cases.flatMap(item => evaluateWorkflowCase(item, now));
    const keyOf = (finding) => finding.fingerprint ?? actionGapFingerprint(finding);
    const oldByKey = new Map(existing.map(item => [keyOf(item), item]));
    const seen = new Set();
    const plan = { create: [], unchanged: [], changed: [], staleOpen: [] };
    const evaluatedCaseIds = new Set(cases.map(item => item.id));
    for (const finding of current) {
        const fingerprint = actionGapFingerprint(finding);
        if (seen.has(fingerprint))
            continue;
        seen.add(fingerprint);
        const previous = oldByKey.get(fingerprint);
        if (!previous) {
            plan.create.push(finding);
            continue;
        }
        const comparable = (x) => JSON.stringify({ severity: x.severity, explanation: x.explanation, supportingEvidence: x.supportingEvidence, recommendedNextStep: x.recommendedNextStep, ruleVersion: x.ruleVersion });
        if (comparable(previous) === comparable(finding))
            plan.unchanged.push(finding);
        else
            plan.changed.push({ fingerprint, previous, current: finding });
    }
    // Only identify stale candidates when their exact workflow case was evaluated.
    // Missing/partial case data must never cause an unrelated detection to be closed.
    for (const previous of existing) {
        const evidenceCaseId = typeof previous.supportingEvidence.workflowCaseId === 'string'
            ? previous.supportingEvidence.workflowCaseId : 'signal';
        const fingerprint = keyOf(previous);
        if (previous.status !== 'open' || !evaluatedCaseIds.has(evidenceCaseId) || seen.has(fingerprint))
            continue;
        plan.staleOpen.push({ fingerprint, previous, workflowCaseId: evidenceCaseId });
    }
    return plan;
}
