import type { DecisionIntake, ResponseActionIntake, ResponseActionUpdate } from '@publipulse/shared';
import type { SqlConnection, SqlPool } from './postgres-signal-store.js';
import type { VerifiedActor } from './signal-store.js';
import type { DecisionActionStore, StoredDecision, StoredResponseAction, CreateDecisionResult, CreateActionResult, UpdateActionResult } from './decision-action-store.js';

type DRow = { id:string; organization_id:string; signal_id:string; investigation_id:string|null; decided_by:string; decision:StoredDecision['decision']; rationale:string; evidence_summary:string|null; created_at:Date|string };
type ARow = { id:string; organization_id:string; signal_id:string; decision_id:string|null; title:string; description:string|null; owner_user_id:string; status:StoredResponseAction['status']; due_at:Date|string|null; completed_at:Date|string|null; completion_evidence:string|null; created_by:string; created_at:Date|string; updated_at:Date|string; version:number };
const dcols='id, organization_id, signal_id, investigation_id, decided_by, decision, rationale, evidence_summary, created_at';
const acols='id, organization_id, signal_id, decision_id, title, description, owner_user_id, status, due_at, completed_at, completion_evidence, created_by, created_at, updated_at, version';
const iso=(v:Date|string|null) => v == null ? null : new Date(v).toISOString();
const mapD=(r:DRow):StoredDecision=>({id:r.id,organizationId:r.organization_id,signalId:r.signal_id,investigationId:r.investigation_id,decidedBy:r.decided_by,decision:r.decision,rationale:r.rationale,evidenceSummary:r.evidence_summary,createdAt:iso(r.created_at)!});
const mapA=(r:ARow):StoredResponseAction=>({id:r.id,organizationId:r.organization_id,signalId:r.signal_id,decisionId:r.decision_id,title:r.title,description:r.description,ownerUserId:r.owner_user_id,status:r.status,dueAt:iso(r.due_at),completedAt:iso(r.completed_at),completionEvidence:r.completion_evidence,createdBy:r.created_by,createdAt:iso(r.created_at)!,updatedAt:iso(r.updated_at)!,version:r.version});

const allowedActionTransitions: Record<StoredResponseAction['status'], readonly StoredResponseAction['status'][]> = {
 open: ['in_progress', 'blocked', 'cancelled'],
 in_progress: ['blocked', 'completed', 'cancelled'],
 blocked: ['in_progress', 'cancelled'],
 completed: [],
 cancelled: [],
};

/** Same-status edits are allowed; state changes must follow the accountable workflow. */
export function isAllowedResponseActionTransition(from: StoredResponseAction['status'], to: StoredResponseAction['status']): boolean {
 return from === to || allowedActionTransitions[from].includes(to);
}
export class PostgresDecisionActionStore implements DecisionActionStore {
 constructor(private readonly pool:SqlPool){}
 private async begin(actor:VerifiedActor){
  const c:SqlConnection=await this.pool.connect();
  try{
   await c.query('BEGIN');
   await c.query("SELECT set_config('app.organization_id', $1, true)",[actor.organizationId]);
   return c;
  }catch(error){
   try{await c.query('ROLLBACK')}catch{}
   try{c.release()}catch{}
   throw error;
  }
 }
 async createDecision(actor:VerifiedActor,signalId:string,input:DecisionIntake):Promise<CreateDecisionResult>{const c=await this.begin(actor);let operationFailed=false;try{
  const s=await c.query<{id:string}>('SELECT id FROM signals WHERE organization_id=$1 AND id=$2 FOR KEY SHARE',[actor.organizationId,signalId]);if(!s.rows[0]){await c.query('ROLLBACK');return{kind:'signal_not_found'};}
  if(input.investigationId){const i=await c.query<{id:string}>('SELECT id FROM investigations WHERE organization_id=$1 AND signal_id=$2 AND id=$3 FOR KEY SHARE',[actor.organizationId,signalId,input.investigationId]);if(!i.rows[0]){await c.query('ROLLBACK');return{kind:'investigation_not_found'};}}
  const r=await c.query<DRow>(`INSERT INTO decisions (organization_id,signal_id,investigation_id,decided_by,decision,rationale,evidence_summary) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${dcols}`,[actor.organizationId,signalId,input.investigationId??null,actor.userId,input.decision,input.rationale,input.evidenceSummary??null]);const row=r.rows[0];if(!row)throw new Error('Decision insert returned no row');
  await c.query("INSERT INTO graph_edges (organization_id,from_type,from_id,relation,to_type,to_id,created_by) VALUES($1,'signal',$2,'decides','decision',$3,$4) ON CONFLICT DO NOTHING",[actor.organizationId,signalId,row.id,actor.userId]);
  await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'decision.created','decision',$3,'success',$4::jsonb)",[actor.organizationId,actor.userId,row.id,JSON.stringify({signalId,decision:row.decision,investigationId:row.investigation_id})]);await c.query('COMMIT');return{kind:'created',decision:mapD(row)};
 }catch(e){operationFailed=true;try{await c.query('ROLLBACK')}catch{}throw e}finally{try{c.release()}catch(releaseError){if(!operationFailed)throw releaseError}}}
 async listDecisions(actor:VerifiedActor,signalId:string,limit:number):Promise<StoredDecision[]|null>{const c=await this.pool.connect();let operationFailed=false;try{await c.query('BEGIN READ ONLY');await c.query("SELECT set_config('app.organization_id',$1,true)",[actor.organizationId]);const s=await c.query<{id:string}>('SELECT id FROM signals WHERE organization_id=$1 AND id=$2',[actor.organizationId,signalId]);if(!s.rows[0]){await c.query('COMMIT');return null}const r=await c.query<DRow>(`SELECT ${dcols} FROM decisions WHERE organization_id=$1 AND signal_id=$2 ORDER BY created_at DESC LIMIT $3`,[actor.organizationId,signalId,limit]);await c.query('COMMIT');return r.rows.map(mapD)}catch(e){operationFailed=true;try{await c.query('ROLLBACK')}catch{}throw e}finally{try{c.release()}catch(releaseError){if(!operationFailed)throw releaseError}}}
 async createAction(actor:VerifiedActor,signalId:string,input:ResponseActionIntake):Promise<CreateActionResult>{const c=await this.begin(actor);let operationFailed=false;try{
  const s=await c.query<{id:string}>('SELECT id FROM signals WHERE organization_id=$1 AND id=$2 FOR KEY SHARE',[actor.organizationId,signalId]);if(!s.rows[0]){await c.query('ROLLBACK');return{kind:'signal_not_found'};}
  if(input.decisionId){const d=await c.query<{id:string}>('SELECT id FROM decisions WHERE organization_id=$1 AND signal_id=$2 AND id=$3 FOR KEY SHARE',[actor.organizationId,signalId,input.decisionId]);if(!d.rows[0]){await c.query('ROLLBACK');return{kind:'decision_not_found'};}}
  const m=await c.query<{user_id:string}>('SELECT user_id FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 AND active=true',[actor.organizationId,input.ownerUserId]);if(!m.rows[0]){await c.query('ROLLBACK');return{kind:'invalid_owner'};}
  const r=await c.query<ARow>(`INSERT INTO response_actions (organization_id,signal_id,decision_id,title,description,owner_user_id,due_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${acols}`,[actor.organizationId,signalId,input.decisionId??null,input.title,input.description??null,input.ownerUserId,input.dueAt??null,actor.userId]);const row=r.rows[0];if(!row)throw new Error('Response action insert returned no row');
  if(input.decisionId) await c.query("INSERT INTO graph_edges (organization_id,from_type,from_id,relation,to_type,to_id,created_by) VALUES($1,'decision',$2,'triggers','action',$3,$4) ON CONFLICT DO NOTHING",[actor.organizationId,input.decisionId,row.id,actor.userId]); else await c.query("INSERT INTO graph_edges (organization_id,from_type,from_id,relation,to_type,to_id,created_by) VALUES($1,'signal',$2,'triggers','action',$3,$4) ON CONFLICT DO NOTHING",[actor.organizationId,signalId,row.id,actor.userId]);
  await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'response_action.created','response_action',$3,'success',$4::jsonb)",[actor.organizationId,actor.userId,row.id,JSON.stringify({signalId,decisionId:row.decision_id,ownerUserId:row.owner_user_id,hasDueDate:Boolean(row.due_at)})]);await c.query('COMMIT');return{kind:'created',action:mapA(row)};
 }catch(e){operationFailed=true;try{await c.query('ROLLBACK')}catch{}throw e}finally{try{c.release()}catch(releaseError){if(!operationFailed)throw releaseError}}}
 async listActions(actor:VerifiedActor,signalId:string,limit:number):Promise<StoredResponseAction[]|null>{const c=await this.pool.connect();let operationFailed=false;try{await c.query('BEGIN READ ONLY');await c.query("SELECT set_config('app.organization_id',$1,true)",[actor.organizationId]);const s=await c.query<{id:string}>('SELECT id FROM signals WHERE organization_id=$1 AND id=$2',[actor.organizationId,signalId]);if(!s.rows[0]){await c.query('COMMIT');return null}const r=await c.query<ARow>(`SELECT ${acols} FROM response_actions WHERE organization_id=$1 AND signal_id=$2 ORDER BY created_at DESC LIMIT $3`,[actor.organizationId,signalId,limit]);await c.query('COMMIT');return r.rows.map(mapA)}catch(e){operationFailed=true;try{await c.query('ROLLBACK')}catch{}throw e}finally{try{c.release()}catch(releaseError){if(!operationFailed)throw releaseError}}}
 async updateAction(actor:VerifiedActor,id:string,input:ResponseActionUpdate):Promise<UpdateActionResult>{const c=await this.begin(actor);let operationFailed=false;try{const q=await c.query<ARow>(`SELECT ${acols} FROM response_actions WHERE organization_id=$1 AND id=$2 FOR UPDATE`,[actor.organizationId,id]);const old=q.rows[0];if(!old){await c.query('ROLLBACK');return{kind:'not_found'}}
  const manager=actor.roles.some(r=>['owner','administrator','reviewer'].includes(r));const assignee=old.owner_user_id===actor.userId&&actor.roles.some(r=>['responder','investigator'].includes(r));if(!manager&&!assignee){await c.query('ROLLBACK');return{kind:'forbidden'}}
  if(old.version!==input.expectedVersion||old.status==='completed'||old.status==='cancelled'){await c.query('ROLLBACK');return{kind:'conflict'}}
  const status=input.status??old.status;if(!isAllowedResponseActionTransition(old.status,status)){await c.query('ROLLBACK');return{kind:'conflict'}}
  const completionEvidence=input.completionEvidence===undefined?old.completion_evidence:input.completionEvidence; if(status==='completed'&&(!completionEvidence||completionEvidence.trim().length<3)){await c.query('ROLLBACK');return{kind:'conflict'}}
  const r=await c.query<ARow>(`UPDATE response_actions SET status=$3,due_at=$4,completion_evidence=$5,completed_at=CASE WHEN $3='completed' THEN now() ELSE NULL END,updated_at=now(),version=version+1 WHERE organization_id=$1 AND id=$2 RETURNING ${acols}`,[actor.organizationId,id,status,input.dueAt===undefined?old.due_at:input.dueAt,completionEvidence]);const row=r.rows[0];if(!row)throw new Error('Response action update returned no row');
  await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'response_action.updated','response_action',$3,'success',$4::jsonb)",[actor.organizationId,actor.userId,id,JSON.stringify({previousStatus:old.status,status:row.status,previousVersion:old.version,version:row.version,dueDateChanged:input.dueAt!==undefined,completionEvidenceChanged:input.completionEvidence!==undefined})]);await c.query('COMMIT');return{kind:'updated',action:mapA(row)};
 }catch(e){operationFailed=true;try{await c.query('ROLLBACK')}catch{}throw e}finally{try{c.release()}catch(releaseError){if(!operationFailed)throw releaseError}}}
}
