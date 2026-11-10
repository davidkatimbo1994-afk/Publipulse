import { describe, expect, it } from 'vitest';
import { summarizeOperationalLearning } from '../src/learning.js';
import type { WorkflowCase } from '../src/action-gap/evaluator.js';

const base = (overrides: Partial<WorkflowCase> = {}): WorkflowCase => ({ id: '1', signalId: 's1', organizationId: 'org-1', stage: 'response', createdAt: '2026-10-10T00:00:00Z', status: 'in_progress', category: 'environmental_hazard', administrativeAreaCode: 'UG-C', owner: 'user', outcomeEvidence: false, recurrences: 1, ...overrides });

describe('operational learning', () => {
  it('aggregates bounded workflow indicators without causal claims', () => {
    const result = summarizeOperationalLearning([base(), base({ id: '2', signalId: 's2', category: 'environmental_hazard', recurrences: 0, outcomeEvidence: true, owner: null, dueAt: '2026-10-01T00:00:00Z' }), base({ id: '3', signalId: 's3', category: 'community_report', handoffAt: '2026-10-01T00:00:00Z', handoffAcceptedAt: null })], Date.parse('2026-10-12T00:00:00Z'));
    expect(result.evaluatedCases).toBe(3);
    expect(result.repeatedCases).toBe(2);
    expect(result.casesWithOutcomeEvidence).toBe(1);
    expect(result.byCategory.environmental_hazard).toBe(2);
    expect(result.recurringCategories[0]).toMatchObject({ category: 'environmental_hazard', repeatedCases: 1 });
    expect(result.operationalSignals).toContain('ownership_gap');
    expect(result.operationalSignals).toContain('outcome_evidence_gap');
  });
});


describe('weekly decision input contract', () => {
  it('requires a replay-safe client mutation identity', async () => {
    const { WeeklyDecisionInputSchema } = await import('@publipulse/shared/weekly-decision');
    const base = {
      clientMutationId: 'weekly-decision-2026-10-16-001',
      weekStart: '2026-10-12T00:00:00Z',
      weekEnd: '2026-10-16T00:00:00Z',
      administrativeAreaCode: 'UG-C',
      agendaCode: 'unresolved_outcome',
      decision: 'insufficient_evidence',
      rationale: 'Outcome evidence is incomplete and requires another review cycle.',
      nextCheckAt: '2026-10-23T00:00:00Z',
      ownerRole: 'district_lead'
    };
    expect(WeeklyDecisionInputSchema.safeParse(base).success).toBe(true);
    expect(WeeklyDecisionInputSchema.safeParse({ ...base, clientMutationId: 'short' }).success).toBe(false);
  });
});
