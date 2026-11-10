/**
 * PubliPulse Action Gap Engine — deterministic triage for workflow gaps.
 * This is a transparent rule engine, not a diagnosis or an outbreak detector.
 * Inputs should be verified workflow metadata; humans retain decision authority.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const rules = [
  { code: 'UNVERIFIED', label: 'Verification overdue', weight: 24, applies: (c, now) => c.stage === 'signal' && !c.verifiedAt && daysSince(c.createdAt, now) >= 2, detail: 'Signal has no recorded verification after 48 hours.' },
  { code: 'NO_OWNER', label: 'No accountable owner', weight: 25, applies: c => ['investigation', 'decision', 'response'].includes(c.stage) && !c.owner, detail: 'A workflow stage is active but no responsible owner is recorded.' },
  { code: 'OVERDUE', label: 'Action overdue', weight: 24, applies: (c, now) => ['investigation', 'decision', 'response'].includes(c.stage) && c.dueAt && new Date(c.dueAt).getTime() < now && !['completed', 'dismissed'].includes(c.status), detail: 'The recorded due date has passed and the item is not resolved.' },
  { code: 'BLOCKED', label: 'Response blocked', weight: 22, applies: c => c.status === 'blocked' || Boolean(c.blocker), detail: 'A declared blocker is preventing the next response step.' },
  { code: 'NO_EVIDENCE', label: 'Outcome evidence missing', weight: 18, applies: c => c.status === 'completed' && !c.outcomeEvidence, detail: 'The workflow is marked complete but no outcome evidence is attached.' },
  { code: 'REPEATED', label: 'Problem has recurred', weight: 16, applies: c => Number(c.recurrences || 0) > 0, detail: 'Similar concern has been recorded before; check whether the previous response addressed the cause.' },
  { code: 'LOW_CONFIDENCE', label: 'Evidence needs review', weight: 12, applies: c => c.evidenceQuality === 'limited' || c.evidenceQuality === 'conflicting', detail: 'Evidence quality is limited or conflicting; avoid treating this as a confirmed event.' },
  { code: 'RESOURCE_DECISION_MISSING', label: 'Required decision or resource missing', weight: 22, applies: c => ['decision','resource','funding','supplies','authorization'].includes(String(c.blockerType || '').toLowerCase()) && Boolean(c.blocker), detail: 'A missing decision, resource, supply, funding, or authorization is recorded as blocking the next step.' },
  { code: 'HANDOFF_STALLED', label: 'Responsibility hand-off stalled', weight: 20, applies: (c, now) => Boolean(c.handoffAt) && !c.handoffAcceptedAt && daysSince(c.handoffAt, now) >= Number(c.handoffSlaDays || 2) && !['completed','dismissed'].includes(c.status), detail: 'A hand-off has not been acknowledged within its configured service window.' },
  { code: 'RECENTLY_REOPENED', label: 'Resolved concern reappeared', weight: 20, applies: (c, now) => Boolean(c.resolvedAt && c.reappearedAt) && new Date(c.reappearedAt).getTime() >= new Date(c.resolvedAt).getTime() && daysSince(c.resolvedAt, now) <= Number(c.recurrenceWindowDays || 30), detail: 'A concern marked resolved has reappeared within the configured recurrence window; verify whether this is the same underlying issue.' },
  { code: 'CROSS_FACILITY_PATTERN', label: 'Similar reports across facilities', weight: 18, applies: c => Number(c.matchingFacilityCount || 0) >= 2, detail: 'Similar reports are recorded across multiple facilities; a reviewer should verify whether they share a cause.' }
];

function daysSince(date, now) {
  const time = new Date(date).getTime();
  return Number.isFinite(time) ? Math.floor((now - time) / DAY_MS) : 0;
}

export function evaluateActionGaps(cases, now = Date.now()) {
  if (!Array.isArray(cases)) throw new TypeError('cases must be an array');
  return cases.map(item => {
    const matches = rules.filter(rule => rule.applies(item, now));
    const rawScore = matches.reduce((sum, rule) => sum + rule.weight, 0);
    const score = Math.min(100, rawScore);
    const level = score >= 55 ? 'urgent' : score >= 30 ? 'high' : score >= 15 ? 'watch' : 'clear';
    return {
      ...item,
      gapScore: score,
      gapLevel: level,
      gapCount: matches.length,
      gapReasons: matches.map(({ code, label, detail }) => ({ code, label, detail })),
      nextStep: recommendNextStep(item, matches)
    };
  }).sort((a, b) => b.gapScore - a.gapScore || new Date(a.createdAt) - new Date(b.createdAt));
}

function recommendNextStep(item, matches) {
  const codes = new Set(matches.map(m => m.code));
  if (codes.has('UNVERIFIED')) return 'Assign an authorized verifier and record the verification result.';
  if (codes.has('NO_OWNER')) return 'Assign a responsible role and a due date before the workflow proceeds.';
  if (codes.has('RESOURCE_DECISION_MISSING')) return 'Record the specific decision or resource needed, assign an authorized resolver, and set a review date.';
  if (codes.has('HANDOFF_STALLED')) return 'Confirm the receiving organization or role, record acknowledgement, and escalate through the approved pathway if needed.';
  if (codes.has('CROSS_FACILITY_PATTERN')) return 'Compare the reports using approved aggregate information and assign a reviewer to verify the possible shared pattern.';
  if (codes.has('RECENTLY_REOPENED')) return 'Link the new report to the prior concern for review; do not assume the prior response caused or failed to cause recurrence.';
  if (codes.has('BLOCKED')) return 'Name the blocker, responsible resolver, and expected resolution date.';
  if (codes.has('OVERDUE')) return 'Review the delay and record a revised plan or escalation decision.';
  if (codes.has('NO_EVIDENCE')) return 'Attach a follow-up measure or mark the outcome as unknown.';
  if (codes.has('LOW_CONFIDENCE')) return 'Request corroboration; keep the concern unconfirmed until reviewed.';
  if (codes.has('REPEATED')) return 'Compare this event with prior cases and document whether the root cause was addressed.';
  return item.status === 'completed' ? 'Review the outcome at the agreed follow-up point.' : 'Continue the assigned workflow and preserve supporting evidence.';
}

export const ACTION_GAP_RULES = rules.map(({ code, label, weight, detail }) => ({ code, label, weight, detail }));
