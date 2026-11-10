import type { ExternalContextObservation, ContextComparison } from '@publipulse/shared';
import type { VerifiedActor } from './signal-store.js';
export interface StoredContextObservation extends ExternalContextObservation { id:string; organizationId:string; recordedBy:string; createdAt:string; }
export type CreateContextResult={kind:'created'|'replayed'; observation:StoredContextObservation}|{kind:'mutation_conflict'};
export interface SignalContext { signalId:string; administrativeAreaCode:string; window:{from:string;to:string}; observations:StoredContextObservation[]; comparisons:ContextComparison[]; }
export interface ContextStore { record(actor:VerifiedActor,input:ExternalContextObservation,clientMutationId?:string):Promise<CreateContextResult>; list(actor:VerifiedActor,filter:{areaCode?:string;metricCode?:string},limit:number):Promise<StoredContextObservation[]>; forSignal(actor:VerifiedActor,signalId:string):Promise<SignalContext|null>; }
export const canRecordContext=(actor:VerifiedActor)=>actor.roles.some(r=>['owner','administrator','reviewer','analyst'].includes(r));
export const canReadContext=(actor:VerifiedActor)=>actor.roles.some(r=>['owner','administrator','reviewer','responder','analyst','read_only','auditor'].includes(r));
