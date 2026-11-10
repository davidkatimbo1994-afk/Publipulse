import { describe, expect, it } from 'vitest';
import { planActionGapReconciliation, actionGapFingerprint } from './reconciliation.js';
const now = Date.parse('2026-10-12T09:00:00Z');
const base = { id: 'case-1', signalId: 'signal-1', organizationId: 'org-1', stage: 'signal', createdAt: '2026-10-09T09:00:00Z', status: 'open', verifiedAt: null };
describe('Action Gap reconciliation planning', () => {
    it('creates a finding when none exists', () => { expect(planActionGapReconciliation([base], [], now).create.length).toBe(1); });
    it('is idempotent when evaluated again', () => { const first = planActionGapReconciliation([base], [], now).create; const p = planActionGapReconciliation([base], first, now); expect(p.create.length).toBe(0); expect(p.unchanged.length).toBe(1); });
    it('uses case, signal, rule and version in fingerprint', () => { const f = planActionGapReconciliation([base], [], now).create[0]; expect(actionGapFingerprint(f)).toBe('signal-1:case-1:UNVERIFIED:1.0.0'); expect(actionGapFingerprint(f)).not.toBe(actionGapFingerprint({ ...f, ruleVersion: '1.1.0' })); });
    it('plans changed evidence without deleting prior record', () => { const first = planActionGapReconciliation([base], [], now).create; const p = planActionGapReconciliation([{ ...base, createdAt: '2026-10-08T09:00:00Z' }], first, now); expect(p.changed.length).toBe(1); });
    it('deduplicates duplicate cases in one batch', () => { expect(planActionGapReconciliation([base, base], [], now).create.length).toBe(1); });
    it('marks a missing finding as stale only for an evaluated case and only while open', () => {
        const active = planActionGapReconciliation([base], [], now).create[0];
        const stale = { ...active, supportingEvidence: { ...active.supportingEvidence, workflowCaseId: 'case-1' }, status: 'open' };
        const reviewed = { ...stale, status: 'acknowledged' };
        const unrelated = { ...stale, supportingEvidence: { ...stale.supportingEvidence, workflowCaseId: 'case-outside-scope' } };
        const plan = planActionGapReconciliation([{ ...base, verifiedAt: '2026-10-12T08:00:00Z' }], [stale, reviewed, unrelated], now);
        expect(plan.staleOpen.length).toBe(1);
        expect(plan.staleOpen[0].workflowCaseId).toBe('case-1');
    });
    it('does not suggest stale resolution when the same fingerprint remains active', () => {
        const active = planActionGapReconciliation([base], [], now).create[0];
        const persisted = { ...active, supportingEvidence: { ...active.supportingEvidence, workflowCaseId: 'case-1' }, status: 'open' };
        const plan = planActionGapReconciliation([base], [persisted], now);
        expect(plan.staleOpen.length).toBe(0);
    });
});
