import type { WorkflowCase } from './action-gap/evaluator.js';

export type LearningSummary = {
  evaluatedCases: number;
  repeatedCases: number;
  casesWithOutcomeEvidence: number;
  overdueCases: number;
  unownedCases: number;
  stalledHandoffs: number;
  byStage: Record<WorkflowCase['stage'], number>;
  byCategory: Record<string, number>;
  byAdministrativeArea: Record<string, number>;
  recurringCategories: Array<{ category: string; cases: number; repeatedCases: number }>;
  operationalSignals: Array<'repeated_concern'|'outcome_evidence_gap'|'overdue_response'|'handoff_delay'|'ownership_gap'>;
};

const isOpenStatus = (status: string) => !['completed', 'dismissed', 'resolved', 'closed'].includes(status);

/**
 * Produces bounded, tenant-scoped operational learning indicators.
 * This deliberately aggregates workflow metadata only; it does not infer outbreaks,
 * diagnoses, causal effects, or cross-tenant comparisons.
 */
export function summarizeOperationalLearning(cases: WorkflowCase[], now = Date.now()): LearningSummary {
  const byStage: LearningSummary['byStage'] = { signal: 0, investigation: 0, decision: 0, response: 0 };
  const byCategory: Record<string, number> = {};
  const byAdministrativeArea: Record<string, number> = {};
  const repeatedByCategory: Record<string, number> = {};
  let repeatedCases = 0;
  let casesWithOutcomeEvidence = 0;
  let overdueCases = 0;
  let unownedCases = 0;
  let stalledHandoffs = 0;

  for (const item of cases) {
    byStage[item.stage] += 1;
    const category = item.id ? String((item as WorkflowCase & { category?: string }).category ?? 'unspecified') : 'unspecified';
    const area = String((item as WorkflowCase & { administrativeAreaCode?: string }).administrativeAreaCode ?? 'unspecified');
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    byAdministrativeArea[area] = (byAdministrativeArea[area] ?? 0) + 1;
    if (item.outcomeEvidence) casesWithOutcomeEvidence += 1;
    if ((item.recurrences ?? 0) > 0) {
      repeatedCases += 1;
      repeatedByCategory[category] = (repeatedByCategory[category] ?? 0) + 1;
    }
    if (['investigation', 'decision', 'response'].includes(item.stage) && item.dueAt && Date.parse(item.dueAt) < now && isOpenStatus(item.status)) overdueCases += 1;
    if (['investigation', 'decision', 'response'].includes(item.stage) && !item.owner) unownedCases += 1;
    if (item.handoffAt && !item.handoffAcceptedAt && isOpenStatus(item.status)) stalledHandoffs += 1;
  }

  const recurringCategories = Object.entries(byCategory)
    .map(([category, count]) => ({ category, cases: count, repeatedCases: repeatedByCategory[category] ?? 0 }))
    .filter(item => item.repeatedCases > 0)
    .sort((a, b) => b.repeatedCases - a.repeatedCases || b.cases - a.cases)
    .slice(0, 10);

  const operationalSignals: LearningSummary['operationalSignals'] = [];
  if (repeatedCases) operationalSignals.push('repeated_concern');
  if (casesWithOutcomeEvidence < cases.length) operationalSignals.push('outcome_evidence_gap');
  if (overdueCases) operationalSignals.push('overdue_response');
  if (stalledHandoffs) operationalSignals.push('handoff_delay');
  if (unownedCases) operationalSignals.push('ownership_gap');

  return { evaluatedCases: cases.length, repeatedCases, casesWithOutcomeEvidence, overdueCases, unownedCases, stalledHandoffs, byStage, byCategory, byAdministrativeArea, recurringCategories, operationalSignals };
}
