import { describe, it, expect, vi } from 'vitest';
import { evaluateAndPersistActionGaps } from './runner.js';
import type { ActionGapStore } from '../action-gap-store.js';
import type { WorkflowCase } from './evaluator.js';
import type { VerifiedActor } from '../signal-store.js';

const actor: VerifiedActor = { userId: 'user-1', organizationId: 'org-a', roles: ['reviewer'] };
const own: WorkflowCase = { id: 'case-1', signalId: 'signal-1', organizationId: 'org-a', stage: 'signal', createdAt: '2026-10-09T00:00:00Z', status: 'open' };
const foreign: WorkflowCase = { ...own, id: 'case-2', signalId: 'signal-2', organizationId: 'org-b' };
const detection = { id: 'gap-1', organizationId: 'org-a', signalId: 'signal-1', ruleCode: 'UNVERIFIED' as const, ruleVersion: '1.0.0', severity: 'urgent' as const, explanation: 'test', supportingEvidence: {}, recommendedNextStep: 'verify', status: 'dismissed' as const, detectedAt: '2026-10-12T00:00:00Z', reviewedBy: 'user-2', reviewedAt: '2026-10-12T00:01:00Z', reviewNote: 'not applicable' };
function storeWith(create: ActionGapStore['create']): ActionGapStore {
  return { create, list: vi.fn(), review: vi.fn(), reconcileEvaluatedCase: vi.fn().mockResolvedValue(0) } as unknown as ActionGapStore;
}
describe('evaluateAndPersistActionGaps', () => {
  it('persists findings only for the actor organization', async () => {
    const create = vi.fn().mockResolvedValue({ kind: 'created', detection });
    const result = await evaluateAndPersistActionGaps(actor, [own, foreign], storeWith(create), Date.parse('2026-10-12T00:00:00Z'));
    expect(result.evaluatedCases).toBe(1);
    expect(result.skippedForeignOrganizationCases).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0].organizationId).toBe('org-a');
  });
  it('counts idempotent replays without rewriting review state', async () => {
    const create = vi.fn().mockResolvedValue({ kind: 'existing', detection });
    const result = await evaluateAndPersistActionGaps(actor, [own], storeWith(create), Date.parse('2026-10-12T00:00:00Z'));
    expect(result.replayed).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(detection.status).toBe('dismissed');
    expect(detection.reviewNote).toBe('not applicable');
  });

  it('does not reconcile a case when any finding fails to persist', async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ kind: 'created', detection })
      .mockResolvedValueOnce({ kind: 'signal_not_found' });
    const store = storeWith(create);
    const result = await evaluateAndPersistActionGaps(actor, [{ ...own, stage: 'response', status: 'blocked', owner: null, blocker: 'missing resource' } as WorkflowCase], store, Date.parse('2026-10-12T00:00:00Z'));
    expect(result.missingSignals).toBe(1);
    expect(store.reconcileEvaluatedCase).not.toHaveBeenCalled();
  });
  it('reconciles only after every finding in the case was persisted', async () => {
    const create = vi.fn().mockResolvedValue({ kind: 'created', detection });
    const store = storeWith(create);
    await evaluateAndPersistActionGaps(actor, [own], store, Date.parse('2026-10-12T00:00:00Z'));
    expect(store.reconcileEvaluatedCase).toHaveBeenCalledTimes(1);
    expect(store.reconcileEvaluatedCase).toHaveBeenCalledWith(actor, own.signalId, own.id, expect.any(Array));
  });
  it('does not reconcile when persistence throws during a case', async () => {
    const create = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const store = storeWith(create);
    await expect(evaluateAndPersistActionGaps(actor, [own], store, Date.parse('2026-10-12T00:00:00Z'))).rejects.toThrow('database unavailable');
    expect(store.reconcileEvaluatedCase).not.toHaveBeenCalled();
  });
  it('does not attempt reconciliation after an earlier case persistence failure aborts the run', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('temporary write failure'));
    const store = storeWith(create);
    await expect(evaluateAndPersistActionGaps(actor, [own, { ...own, id: 'case-2', signalId: 'signal-2' }], store, Date.parse('2026-10-12T00:00:00Z'))).rejects.toThrow('temporary write failure');
    expect(store.reconcileEvaluatedCase).not.toHaveBeenCalled();
  });


  it('aborts the run when reconciliation fails and does not process later cases', async () => {
    const create = vi.fn().mockResolvedValue({ kind: 'created', detection });
    const store = storeWith(create);
    (store.reconcileEvaluatedCase as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('reconciliation transaction failed'));
    await expect(evaluateAndPersistActionGaps(actor, [own, { ...own, id: 'case-2', signalId: 'signal-2' }], store, Date.parse('2026-10-12T00:00:00Z'))).rejects.toThrow('reconciliation transaction failed');
    expect(store.reconcileEvaluatedCase).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reports missing signal references instead of claiming persistence', async () => {
    const create = vi.fn().mockResolvedValue({ kind: 'signal_not_found' });
    const result = await evaluateAndPersistActionGaps(actor, [own], storeWith(create), Date.parse('2026-10-12T00:00:00Z'));
    expect(result.missingSignals).toBe(1);
    expect(result.created).toBe(0);
  });
});
