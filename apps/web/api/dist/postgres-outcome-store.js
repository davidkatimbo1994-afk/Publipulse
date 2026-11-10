const cols = 'id, organization_id, signal_id, action_id, indicator_code, indicator_label, baseline_value, target_value, measured_value, unit, measured_at, method_note, limitation_note, recorded_by, created_at, assessment_result, evidence_source, assessment_method, uncertainty_note';
const iso = (v) => new Date(v).toISOString();
/** DB limits (migrations 001/011): indicator_code <=120 chars, assessment_method <=1000 chars. */
export const ASSESSMENT_METHOD_MAX = 1000;
export function indicatorCode(name) { const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100).replace(/^-+|-+$/g, ''); return `assessment:${slug || 'indicator'}`; }
function map(r) { return { id: r.id, organizationId: r.organization_id, signalId: r.signal_id, actionId: r.action_id, indicatorName: r.indicator_label, result: r.assessment_result ?? 'inconclusive', ...(r.baseline_value !== null ? { baselineValue: Number(r.baseline_value) } : {}), ...(r.target_value !== null ? { targetValue: Number(r.target_value) } : {}), ...(r.measured_value !== null ? { followUpValue: Number(r.measured_value) } : {}), ...(r.unit ? { unit: r.unit } : {}), evidenceSummary: r.method_note, ...(r.evidence_source ? { evidenceReference: r.evidence_source } : {}), ...(r.uncertainty_note ? { uncertaintyNote: r.uncertainty_note } : {}), assessedAt: iso(r.measured_at), recordedBy: r.recorded_by, createdAt: iso(r.created_at) }; }
/** A replayed client mutation must target the same signal and action as the stored outcome. */
function sameMutation(r, signalId, actionId) { return r.signal_id === signalId && r.action_id === actionId; }
export class PostgresOutcomeStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async create(actor, signalId, input, clientMutationId) { try {
        return await this.attempt(actor, signalId, input, clientMutationId);
    }
    catch (e) {
        if (clientMutationId && e.code === '23505') { /* The first connection is already released here, so recovery never holds two pool connections. */
            const prior = await this.findByMutation(actor, clientMutationId);
            if (prior)
                return sameMutation(prior, signalId, input.actionId) ? { kind: 'created', outcome: map(prior) } : { kind: 'mutation_conflict' };
        }
        throw e;
    } }
    async findByMutation(actor, clientMutationId) { const c = await this.pool.connect(); try {
        await c.query('BEGIN READ ONLY');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        const r = await c.query(`SELECT ${cols} FROM outcomes WHERE organization_id=$1 AND client_mutation_id=$2`, [actor.organizationId, clientMutationId]);
        await c.query('COMMIT');
        return r.rows[0];
    }
    catch (e) {
        try {
            await c.query('ROLLBACK');
        }
        catch { }
        throw e;
    }
    finally {
        c.release();
    } }
    async attempt(actor, signalId, input, clientMutationId) { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        if (clientMutationId) {
            const prior = await c.query(`SELECT ${cols} FROM outcomes WHERE organization_id=$1 AND client_mutation_id=$2`, [actor.organizationId, clientMutationId]);
            if (prior.rows[0]) {
                await c.query('COMMIT');
                return sameMutation(prior.rows[0], signalId, input.actionId) ? { kind: 'created', outcome: map(prior.rows[0]) } : { kind: 'mutation_conflict' };
            }
        }
        const s = await c.query('SELECT id FROM signals WHERE organization_id=$1 AND id=$2 FOR KEY SHARE', [actor.organizationId, signalId]);
        if (!s.rows[0]) {
            await c.query('ROLLBACK');
            return { kind: 'signal_not_found' };
        }
        const a = await c.query('SELECT id FROM response_actions WHERE organization_id=$1 AND signal_id=$2 AND id=$3 FOR KEY SHARE', [actor.organizationId, signalId, input.actionId]);
        if (!a.rows[0]) {
            await c.query('ROLLBACK');
            return { kind: 'action_not_found' };
        }
        const inserted = await c.query(`INSERT INTO outcomes (organization_id,client_mutation_id,signal_id,action_id,indicator_code,indicator_label,baseline_value,target_value,measured_value,unit,measured_at,method_note,limitation_note,recorded_by,assessment_result,evidence_source,assessment_method,uncertainty_note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING ${cols}`, [actor.organizationId, clientMutationId ?? null, signalId, input.actionId, indicatorCode(input.indicatorName), input.indicatorName, input.baselineValue ?? null, input.targetValue ?? null, input.followUpValue ?? null, input.unit ?? null, input.assessedAt, input.evidenceSummary, input.uncertaintyNote ?? null, actor.userId, input.result, input.evidenceReference ?? null, input.evidenceSummary.slice(0, ASSESSMENT_METHOD_MAX), input.uncertaintyNote ?? null]);
        const row = inserted.rows[0];
        if (!row)
            throw new Error('Outcome insert returned no row');
        await c.query("INSERT INTO graph_edges (organization_id,from_type,from_id,relation,to_type,to_id,created_by) VALUES($1,'action',$2,'measures','outcome',$3,$4) ON CONFLICT DO NOTHING", [actor.organizationId, input.actionId, row.id, actor.userId]);
        await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'outcome.assessed','outcome',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, row.id, JSON.stringify({ signalId, actionId: input.actionId, result: input.result, indicatorName: input.indicatorName })]);
        await c.query('COMMIT');
        return { kind: 'created', outcome: map(row) };
    }
    catch (e) {
        try {
            await c.query('ROLLBACK');
        }
        catch { }
        throw e;
    }
    finally {
        c.release();
    } }
    async list(actor, signalId, limit) { const c = await this.pool.connect(); try {
        await c.query('BEGIN READ ONLY');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        const s = await c.query('SELECT id FROM signals WHERE organization_id=$1 AND id=$2', [actor.organizationId, signalId]);
        if (!s.rows[0]) {
            await c.query('COMMIT');
            return null;
        }
        const rows = await c.query(`SELECT ${cols} FROM outcomes WHERE organization_id=$1 AND signal_id=$2 ORDER BY measured_at DESC,created_at DESC LIMIT $3`, [actor.organizationId, signalId, limit]);
        await c.query('COMMIT');
        return rows.rows.map(map);
    }
    catch (e) {
        try {
            await c.query('ROLLBACK');
        }
        catch { }
        throw e;
    }
    finally {
        c.release();
    } }
}
