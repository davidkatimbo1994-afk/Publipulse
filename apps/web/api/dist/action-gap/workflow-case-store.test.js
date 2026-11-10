import { describe, expect, it, vi } from 'vitest';
import { PostgresWorkflowCaseStore } from './workflow-case-store.js';
const actor = { userId: 'user-1', organizationId: 'org-1', roles: ['analyst'] };
describe('PostgresWorkflowCaseStore', () => {
    it('uses transaction-local tenant scope and maps persisted recurrence, decision, blocker, outcome and handoff data', async () => {
        const query = vi.fn(async (sql) => {
            if (sql.includes('SELECT s.id::text AS id'))
                return { rows: [{
                            id: 'signal-1', signal_id: 'signal-1', organization_id: 'org-1', created_at: '2026-10-01T00:00:00Z', signal_status: 'submitted',
                            category: 'unusual_illness', administrative_area_code: 'UG-XX', recurrences: 2, verified_at: null,
                            investigation_id: 'investigation-1', investigation_owner: 'user-2', investigation_status: 'open', investigation_opened_at: '2026-10-02T00:00:00Z',
                            action_id: 'action-1', action_owner: 'user-3', action_status: 'blocked', due_at: '2026-10-03T00:00:00Z', action_created_at: '2026-10-02T00:00:00Z',
                            blocker: 'Awaiting supplies', decision_id: 'decision-1', decision_created_at: '2026-10-02T00:00:00Z', handoff_at: '2026-10-03T00:00:00Z', handoff_accepted_at: null, has_completion_evidence: false, has_evidence: true, has_outcome: false
                        }] };
            return { rows: [] };
        });
        const release = vi.fn();
        const store = new PostgresWorkflowCaseStore({ connect: async () => ({ query: query, release }) });
        const cases = await store.listForEvaluation(actor, 50);
        expect(query).toHaveBeenCalledWith("SELECT set_config('app.organization_id', $1, true)", ['org-1']);
        expect(query.mock.calls.some(([sql]) => sql.includes('WHERE s.organization_id=$1'))).toBe(true);
        expect(query.mock.calls.some(([sql]) => sql.includes('action_handoff_events'))).toBe(true);
        expect(cases[0]).toMatchObject({ stage: 'response', recurrences: 2, blocker: 'Awaiting supplies', outcomeEvidence: false, owner: 'user-3', organizationId: 'org-1', handoffAt: '2026-10-03T00:00:00.000Z', handoffAcceptedAt: null, handoffSlaDays: 2 });
        expect(release).toHaveBeenCalledOnce();
    });
    it('rolls back and releases the connection when the query fails', async () => {
        const query = vi.fn(async (sql) => { if (sql.includes('SELECT s.id::text AS id'))
            throw new Error('query failed'); return { rows: [] }; });
        const release = vi.fn();
        const store = new PostgresWorkflowCaseStore({ connect: async () => ({ query: query, release }) });
        await expect(store.listForEvaluation(actor, 10)).rejects.toThrow('query failed');
        expect(query).toHaveBeenCalledWith('ROLLBACK');
        expect(release).toHaveBeenCalledOnce();
    });
});
