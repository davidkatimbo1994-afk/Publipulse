/**
 * Pure builders for offline action updates and outcome assessments.
 *
 * They mirror the strict server schemas (`ResponseActionUpdateSchema` in packages/shared/src/decision-action.ts and
 * `OutcomeAssessmentSchema` in packages/shared/src/outcome-assessment.ts) so a mutation that can never be accepted
 * is refused on the device instead of sitting in the queue forever. The server remains the authority.
 * No imports on purpose: this file is unit-tested directly by scripts/test-field-mutation-builders.test.mjs.
 */

export const ACTION_STATUSES = ['open', 'in_progress', 'blocked', 'completed', 'cancelled'] as const;
export const OUTCOME_RESULTS = ['improved', 'no_change', 'worsened', 'inconclusive'] as const;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BuildResult = { ok: true; payload: Record<string, unknown> } | { ok: false; error: string };

export type ActionUpdateInput = { expectedVersion: string; status: string; dueAt: string; completionEvidence: string };
export type OutcomeInput = {
  actionId: string;
  indicatorName: string;
  result: string;
  baselineValue: string;
  targetValue: string;
  followUpValue: string;
  unit: string;
  evidenceSummary: string;
  evidenceReference: string;
  uncertaintyNote: string;
};

const fail = (error: string): BuildResult => ({ ok: false, error });

/** '' -> undefined (not supplied); anything not a finite number -> null (invalid). */
function optionalNumber(raw: string): number | undefined | null {
  const t = raw.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function buildActionUpdatePayload(input: ActionUpdateInput): BuildResult {
  const version = Number(input.expectedVersion.trim());
  if (!/^[0-9]+$/.test(input.expectedVersion.trim()) || !Number.isInteger(version) || version < 1 || version > 2147483647) {
    return fail('Enter the action version you last saw (a whole number, 1 or higher).');
  }
  const payload: Record<string, unknown> = { expectedVersion: version };
  if (input.status) {
    if (!(ACTION_STATUSES as readonly string[]).includes(input.status)) return fail('Choose a valid status.');
    payload.status = input.status;
  }
  if (input.dueAt.trim()) {
    const due = new Date(input.dueAt);
    if (Number.isNaN(due.getTime())) return fail('The due date is not valid.');
    payload.dueAt = due.toISOString();
  }
  const evidence = input.completionEvidence.trim();
  if (evidence) {
    if (evidence.length > 4000) return fail('Completion evidence is limited to 4000 characters.');
    payload.completionEvidence = evidence;
  }
  if (payload.status === undefined && payload.dueAt === undefined && payload.completionEvidence === undefined) {
    return fail('Change at least one of status, due date or completion evidence.');
  }
  if (payload.status === 'completed' && evidence.length < 3) {
    return fail('Completion evidence (at least 3 characters) is required to mark an action completed.');
  }
  return { ok: true, payload };
}

export function buildOutcomePayload(input: OutcomeInput, assessedAtIso: string): BuildResult {
  if (!UUID_RE.test(input.actionId.trim())) return fail('Enter the response action ID (UUID) this outcome measures.');
  const indicator = input.indicatorName.trim();
  if (indicator.length < 2 || indicator.length > 240) return fail('Indicator name must be 2 to 240 characters.');
  if (!(OUTCOME_RESULTS as readonly string[]).includes(input.result)) return fail('Choose an assessment result.');
  const baseline = optionalNumber(input.baselineValue);
  const target = optionalNumber(input.targetValue);
  const followUp = optionalNumber(input.followUpValue);
  if (baseline === null || target === null || followUp === null) return fail('Baseline, target and follow-up must be numbers.');
  if (target !== undefined && baseline === undefined) return fail('Enter a baseline value when you enter a target.');
  if (followUp === undefined && input.result !== 'inconclusive') return fail('A follow-up measurement is required unless the result is inconclusive.');
  const unit = input.unit.trim();
  if (unit.length > 80) return fail('Unit is limited to 80 characters.');
  const summary = input.evidenceSummary.trim();
  if (summary.length < 5 || summary.length > 3000) return fail('Evidence summary must be 5 to 3000 characters.');
  const reference = input.evidenceReference.trim();
  if (reference.length > 240) return fail('Evidence reference is limited to 240 characters.');
  const uncertainty = input.uncertaintyNote.trim();
  if (uncertainty.length > 3000) return fail('Uncertainty note is limited to 3000 characters.');
  if (input.result === 'inconclusive' && !uncertainty) return fail('Describe the uncertainty for an inconclusive result.');
  if (Number.isNaN(new Date(assessedAtIso).getTime())) return fail('Assessment time is not valid.');

  const payload: Record<string, unknown> = {
    actionId: input.actionId.trim(),
    indicatorName: indicator,
    result: input.result,
    evidenceSummary: summary,
    assessedAt: assessedAtIso
  };
  if (baseline !== undefined) payload.baselineValue = baseline;
  if (target !== undefined) payload.targetValue = target;
  if (followUp !== undefined) payload.followUpValue = followUp;
  if (unit) payload.unit = unit;
  if (reference) payload.evidenceReference = reference;
  if (uncertainty) payload.uncertaintyNote = uncertainty;
  return { ok: true, payload };
}
