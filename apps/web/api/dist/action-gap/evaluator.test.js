import { describe, expect, it } from 'vitest';
import { evaluateWorkflowCase, ACTION_GAP_RULE_VERSION } from './evaluator.js';
const base = { id: 'case-1', signalId: 'signal-1', organizationId: 'org-1', stage: 'response', createdAt: '2026-10-01T00:00:00Z', status: 'blocked' };
describe('workflow Action Gap evaluator', () => {
    it('returns versioned, explainable findings for missing owner and blocker', () => { const r = evaluateWorkflowCase(base, Date.parse('2026-10-12T00:00:00Z')); expect(r.map(x => x.ruleCode)).toContain('NO_OWNER'); expect(r.map(x => x.ruleCode)).toContain('BLOCKED'); expect(r.every(x => x.ruleVersion === ACTION_GAP_RULE_VERSION && x.supportingEvidence.workflowCaseId === 'case-1')).toBe(true); });
    it('flags cross-facility patterns as review prompts, not confirmed events', () => { const r = evaluateWorkflowCase({ ...base, matchingFacilityCount: 3 }, Date.parse('2026-10-12T00:00:00Z')); const f = r.find(x => x.ruleCode === 'CROSS_FACILITY_PATTERN'); expect(f?.explanation).toContain('reviewer should verify'); expect(f?.recommendedNextStep).toContain('verify'); });
    it('does not flag a recently created unverified signal before 48 hours', () => { const r = evaluateWorkflowCase({ ...base, stage: 'signal', createdAt: '2026-10-11T12:00:00Z', status: 'open' }, Date.parse('2026-10-12T00:00:00Z')); expect(r.some(x => x.ruleCode === 'UNVERIFIED')).toBe(false); });
});
