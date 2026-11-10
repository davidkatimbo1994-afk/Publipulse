/** Deterministic, versioned workflow-gap evaluator. It flags process gaps, not outbreaks. */
export const ACTION_GAP_RULE_VERSION = '1.0.0';
export type WorkflowCase = {
  id: string; signalId: string; organizationId: string; stage: 'signal'|'investigation'|'decision'|'response';
  createdAt: string; status: string; verifiedAt?: string|null; owner?: string|null; dueAt?: string|null;
  blocker?: string|null; blockerType?: string|null; outcomeEvidence?: boolean; recurrences?: number;
  evidenceQuality?: 'good'|'limited'|'conflicting'; handoffAt?: string|null; handoffAcceptedAt?: string|null;
  handoffSlaDays?: number; resolvedAt?: string|null; reappearedAt?: string|null;
  recurrenceWindowDays?: number; matchingFacilityCount?: number; feedbackRecorded?: boolean; sourceType?: string;
};
export type GapFinding = { signalId:string; ruleCode:string; ruleVersion:string; severity:'urgent'|'high'|'watch'|'clear'; explanation:string; supportingEvidence:Record<string,unknown>; recommendedNextStep:string };
const day = 86_400_000;
const since = (v:string|undefined|null, now:number) => { const t=v?Date.parse(v):NaN; return Number.isFinite(t)?Math.floor((now-t)/day):0; };
export function evaluateWorkflowCase(c:WorkflowCase, now=Date.now()):GapFinding[] {
  const findings:GapFinding[]=[];
  const add=(ruleCode:string,weight:number,explanation:string,next:string,evidence:Record<string,unknown>={})=>{
    const severity=weight>=24?'urgent':weight>=18?'high':'watch';
    findings.push({signalId:c.signalId,ruleCode,ruleVersion:ACTION_GAP_RULE_VERSION,severity,explanation,supportingEvidence:{workflowCaseId:c.id,...evidence},recommendedNextStep:next});
  };
  if(c.stage==='signal'&&!c.verifiedAt&&since(c.createdAt,now)>=2) add('UNVERIFIED',24,'Signal has no recorded verification after 48 hours.','Assign an authorized verifier and record the verification result.',{createdAt:c.createdAt});
  if(['investigation','decision','response'].includes(c.stage)&&!c.owner) add('NO_OWNER',25,'An active workflow stage has no recorded accountable owner.','Assign an authorized responsible role and due date.',{stage:c.stage});
  if(['investigation','decision','response'].includes(c.stage)&&c.dueAt&&Date.parse(c.dueAt)<now&&!['completed','dismissed','resolved'].includes(c.status)) add('OVERDUE',24,'The recorded due date has passed and the item is not resolved.','Review the delay and record a revised plan or escalation decision.',{dueAt:c.dueAt,status:c.status});
  if(c.sourceType==='community_report' && c.stage==='response' && c.status==='completed' && !c.feedbackRecorded) add('NO_FEEDBACK_TO_SOURCE',14,'The response is administratively complete but no reporter feedback event is recorded.','Send a bounded, non-identifying status back through an approved channel and record delivery status.',{sourceType:c.sourceType});
  if(c.status==='blocked'||c.blocker) add('BLOCKED',22,'A declared blocker is preventing the next response step.','Name the blocker, responsible resolver, and expected resolution date.',{blocker:c.blocker??null});
  if(c.status==='completed'&&!c.outcomeEvidence) add('NO_EVIDENCE',18,'The workflow is marked complete but has no attached outcome evidence.','Attach a follow-up measure or mark the outcome as unknown.');
  if((c.recurrences??0)>0) add('REPEATED',16,'A similar concern was recorded before; recurrence requires review.','Compare prior cases and document whether the underlying cause was addressed.',{recurrences:c.recurrences});
  if(c.evidenceQuality==='limited'||c.evidenceQuality==='conflicting') add('LOW_CONFIDENCE',12,'Evidence is limited or conflicting; do not treat the concern as confirmed.','Request corroboration and document uncertainty.',{evidenceQuality:c.evidenceQuality});
  if(['decision','resource','funding','supplies','authorization'].includes((c.blockerType??'').toLowerCase())&&c.blocker) add('RESOURCE_DECISION_MISSING',22,'A required decision or resource is recorded as blocking the next step.','Record the specific need, assign an authorized resolver, and set a review date.',{blockerType:c.blockerType});
  if(c.handoffAt&&!c.handoffAcceptedAt&&since(c.handoffAt,now)>=(c.handoffSlaDays??2)&&!['completed','dismissed'].includes(c.status)) add('HANDOFF_STALLED',20,'Responsibility hand-off has not been acknowledged within its service window.','Confirm the receiving role, record acknowledgement, and follow the approved escalation pathway.',{handoffAt:c.handoffAt});
  if(c.resolvedAt&&c.reappearedAt&&Date.parse(c.reappearedAt)>=Date.parse(c.resolvedAt)&&since(c.resolvedAt,now)<=(c.recurrenceWindowDays??30)) add('RECENTLY_REOPENED',20,'A concern reappeared within the configured recurrence window; verify whether it is the same issue.','Link the new report to the prior concern for review; do not infer causation.',{resolvedAt:c.resolvedAt,reappearedAt:c.reappearedAt});
  if((c.matchingFacilityCount??0)>=2) add('CROSS_FACILITY_PATTERN',18,'Similar reports are recorded across facilities; a reviewer should verify whether they share a cause.','Compare approved aggregate information and assign a reviewer to verify the possible shared pattern.',{matchingFacilityCount:c.matchingFacilityCount});
  return findings;
}
