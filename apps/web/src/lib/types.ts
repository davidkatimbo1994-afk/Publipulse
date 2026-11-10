/** Shared web types. */
export type WorkflowEvent = { id: string; caseId: string; occurredAt: string; actor: string; summary: string };
export type DemoCase = {
  id: string; title: string; district: string; createdAt: string; stage: string; status: string;
  owner: string; verifiedAt: string | null; dueAt: string | null; blocker: string;
  outcomeEvidence: string; evidenceQuality: 'preliminary' | 'reviewed' | 'limited' | 'conflicting'; recurrences: number;
  outcomeAssessment?: { indicator: string; baseline: string; target: string; followUp: string; unit: string; result: string; evidence: string; uncertainty: string; assessedAt: string };
};
export type ApiRecord = Record<string, unknown>;
export type ConnectedWorkflow = { signal: ApiRecord | null; evidence: ApiRecord[]; investigations: ApiRecord[]; decisions: ApiRecord[]; actions: ApiRecord[]; outcomes: ApiRecord[]; handoffs: ApiRecord[]; gaps: ApiRecord[] };
export type QueuedSignal = { clientSubmissionId: string; category: string; summary: string; observedAt: string; location: { administrativeAreaCode: string; precision: string }; sourceType: string; queuedAt: string };
export type QueuedMutation = { clientMutationId: string; kind: 'action_update'|'outcome_assessment'; actionId?: string; signalId?: string; payload: Record<string, unknown>; queuedAt: string };
