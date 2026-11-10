import type { VerifiedActor } from './signal-store.js';

export type HandoffEventType = 'initiated' | 'accepted' | 'declined' | 'cancelled';
export interface HandoffEvent { id:string; organizationId:string; actionId:string; eventType:HandoffEventType; fromUserId:string|null; toUserId:string|null; occurredAt:string; note:string|null; recordedBy:string; }
export type HandoffWriteResult = {kind:'created';event:HandoffEvent}|{kind:'action_not_found'}|{kind:'invalid_transition'}|{kind:'recipient_not_active'};
export interface ActionHandoffStore {
  append(actor:VerifiedActor, actionId:string, eventType:HandoffEventType, toUserId:string|null, note:string|null):Promise<HandoffWriteResult>;
  list(actor:VerifiedActor, actionId:string, limit:number):Promise<HandoffEvent[]|null>;
}
export function canManageHandoffs(actor:VerifiedActor):boolean {
 return actor.roles.some(r=>['owner','administrator','reviewer','responder','investigator'].includes(r));
}
