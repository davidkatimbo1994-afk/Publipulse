import type { OutcomeAssessment } from '@publipulse/shared';
import type { VerifiedActor } from './signal-store.js';
export interface StoredOutcomeAssessment extends OutcomeAssessment { id:string; organizationId:string; signalId:string; recordedBy:string; createdAt:string; }
export type CreateOutcomeResult = {kind:'created'; outcome:StoredOutcomeAssessment}|{kind:'signal_not_found'}|{kind:'action_not_found'}|{kind:'mutation_conflict'};
export interface OutcomeStore { create(actor:VerifiedActor,signalId:string,input:OutcomeAssessment,clientMutationId?:string):Promise<CreateOutcomeResult>; list(actor:VerifiedActor,signalId:string,limit:number):Promise<StoredOutcomeAssessment[]|null>; }
export const canCreateOutcomeAssessment=(actor:VerifiedActor)=>actor.roles.some(r=>['owner','administrator','reviewer','investigator','responder','analyst'].includes(r));
export const canReadOutcomeAssessments=(actor:VerifiedActor)=>actor.roles.some(r=>['owner','administrator','reviewer','investigator','responder','analyst','read_only','auditor'].includes(r));
