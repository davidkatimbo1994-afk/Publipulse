import type { VerifiedActor } from './signal-store.js';
export const GAP_RULES = ['UNVERIFIED','NO_OWNER','OVERDUE','BLOCKED','NO_EVIDENCE','REPEATED','LOW_CONFIDENCE','RESOURCE_DECISION_MISSING','HANDOFF_STALLED','RECENTLY_REOPENED','CROSS_FACILITY_PATTERN'] as const;
export type GapRule = typeof GAP_RULES[number];
export type GapStatus = 'open'|'acknowledged'|'dismissed'|'resolved';
export interface ActionGapInput { signalId:string; ruleCode:GapRule; ruleVersion:string; severity:'urgent'|'high'|'watch'|'clear'; explanation:string; supportingEvidence:Record<string,unknown>; recommendedNextStep:string; }
export interface ActionGap extends ActionGapInput { id:string; organizationId:string; status:GapStatus; detectedAt:string; reviewedBy:string|null; reviewedAt:string|null; reviewNote:string|null; }
export type CreateGapResult={kind:'created';detection:ActionGap}|{kind:'existing';detection:ActionGap}|{kind:'signal_not_found'};
export type ReviewGapResult={kind:'updated';detection:ActionGap}|{kind:'not_found'}|{kind:'conflict'};
export interface ActionGapStore { create(actor:VerifiedActor,input:ActionGapInput):Promise<CreateGapResult>; list(actor:VerifiedActor,limit:number,status?:GapStatus):Promise<ActionGap[]>; review(actor:VerifiedActor,id:string,status:Exclude<GapStatus,'open'>,note:string|null,expectedStatus:GapStatus):Promise<ReviewGapResult>; reconcileEvaluatedCase(actor:VerifiedActor,signalId:string,workflowCaseId:string,activeFingerprints:readonly string[]):Promise<number>; }
const managers=['owner','administrator','reviewer'];
export const canCreateGap=(a:VerifiedActor)=>a.roles.some(r=>[...managers,'investigator','analyst'].includes(r));
export const canReadGaps=(a:VerifiedActor)=>a.roles.some(r=>[...managers,'investigator','responder','analyst','read_only','auditor'].includes(r));
export const canReviewGaps=(a:VerifiedActor)=>a.roles.some(r=>managers.includes(r));
