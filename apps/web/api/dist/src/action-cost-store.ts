import type { ActionCostEntry, ActionCostSummary } from '@publipulse/shared';
import type { VerifiedActor } from './signal-store.js';
export interface StoredActionCostEntry extends ActionCostEntry { id:string; organizationId:string; signalId:string; actionId:string; recordedBy:string; createdAt:string; }
export type CreateActionCostResult={kind:'created'|'replayed'; entry:StoredActionCostEntry}|{kind:'action_not_found'}|{kind:'mutation_conflict'};
export interface ActionCostStore { create(actor:VerifiedActor,actionId:string,input:ActionCostEntry,clientMutationId?:string):Promise<CreateActionCostResult>; list(actor:VerifiedActor,actionId:string,limit:number):Promise<StoredActionCostEntry[]|null>; summarize(actor:VerifiedActor,limit:number):Promise<ActionCostSummary[]>; }
export const canRecordActionCost=(actor:VerifiedActor)=>actor.roles.some(r=>['owner','administrator','reviewer','responder'].includes(r));
export const canReadActionCosts=(actor:VerifiedActor)=>actor.roles.some(r=>['owner','administrator','reviewer','responder','analyst','read_only','auditor'].includes(r));
