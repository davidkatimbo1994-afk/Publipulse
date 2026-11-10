import type { VerifiedActor } from '../signal-store.js';
import type { ActionGapInput, ActionGapStore } from '../action-gap-store.js';
import { evaluateWorkflowCase, type WorkflowCase } from './evaluator.js';
import { actionGapFingerprint } from './reconciliation.js';

export type ActionGapRunSummary = {
  evaluatedCases: number;
  skippedForeignOrganizationCases: number;
  findings: number;
  created: number;
  replayed: number;
  missingSignals: number;
  autoResolved: number;
};

/**
 * Evaluate supplied workflow cases and persist findings through the existing
 * tenant-scoped store. The actor's organization is authoritative: foreign
 * cases are skipped, never evaluated or persisted. Store-level unique keys
 * make concurrent/repeated runs safe; existing review status is left intact.
 * The caller must obtain cases from an authorized, organization-scoped query.
 */
export async function evaluateAndPersistActionGaps(
  actor: VerifiedActor,
  cases: WorkflowCase[],
  store: ActionGapStore,
  now = Date.now(),
): Promise<ActionGapRunSummary> {
  const summary: ActionGapRunSummary = {
    evaluatedCases: 0, skippedForeignOrganizationCases: 0,
    findings: 0, created: 0, replayed: 0, missingSignals: 0, autoResolved: 0,
  };

  for (const item of cases) {
    if (item.organizationId !== actor.organizationId) {
      summary.skippedForeignOrganizationCases += 1;
      continue;
    }
    summary.evaluatedCases += 1;
    const evaluatedFindings = evaluateWorkflowCase(item, now);
    const activeFingerprints: string[] = [];
    let casePersistenceComplete = true;
    for (const finding of evaluatedFindings) {
      activeFingerprints.push(actionGapFingerprint(finding));
      summary.findings += 1;
      const input: ActionGapInput = {
        signalId: finding.signalId,
        ruleCode: finding.ruleCode as ActionGapInput['ruleCode'],
        ruleVersion: finding.ruleVersion,
        severity: finding.severity,
        explanation: finding.explanation,
        supportingEvidence: finding.supportingEvidence,
        recommendedNextStep: finding.recommendedNextStep,
      };
      const result = await store.create(actor, input);
      if (result.kind === 'created') summary.created += 1;
      else if (result.kind === 'existing') summary.replayed += 1;
      else { summary.missingSignals += 1; casePersistenceComplete = false; }
    }
    // Do not reconcile when any finding failed to persist; that could close valid gaps.
    if (casePersistenceComplete) {
      summary.autoResolved += await store.reconcileEvaluatedCase(actor, item.signalId, item.id, activeFingerprints);
    }
  }
  return summary;
}
