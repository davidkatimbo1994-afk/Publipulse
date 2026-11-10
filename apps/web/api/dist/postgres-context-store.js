import { compareContextToBaseline, contextWindowFor } from '@publipulse/shared';
const cols = "id, organization_id, administrative_area_code, metric_code, value, unit, to_char(period_start,'YYYY-MM-DD') AS period_start, to_char(period_end,'YYYY-MM-DD') AS period_end, source_label, source_uri, recorded_by, created_at";
const map = (r) => ({ id: r.id, organizationId: r.organization_id, administrativeAreaCode: r.administrative_area_code, metricCode: r.metric_code, value: Number(r.value), unit: r.unit, periodStart: r.period_start, periodEnd: r.period_end, sourceLabel: r.source_label, ...(r.source_uri ? { sourceUri: r.source_uri } : {}), recordedBy: r.recorded_by, createdAt: new Date(r.created_at).toISOString() });
const same = (r, i) => r.administrative_area_code === i.administrativeAreaCode && r.metric_code === i.metricCode && r.unit === i.unit && Math.round(Number(r.value) * 10000) === Math.round(i.value * 10000) && r.period_start === i.periodStart && r.period_end === i.periodEnd && r.source_label === i.sourceLabel && (r.source_uri ?? null) === (i.sourceUri ?? null);
/** Earlier periods of the same metric used as the comparison baseline. */
export const CONTEXT_BASELINE_PERIODS = 8;
export class PostgresContextStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async record(actor, input, clientMutationId) { try {
        return await this.attempt(actor, input, clientMutationId);
    }
    catch (e) {
        if (clientMutationId && e.code === '23505') {
            const prior = await this.findByMutation(actor, clientMutationId);
            if (prior)
                return same(prior, input) ? { kind: 'replayed', observation: map(prior) } : { kind: 'mutation_conflict' };
        }
        throw e;
    } }
    async findByMutation(actor, clientMutationId) { const c = await this.pool.connect(); try {
        await c.query('BEGIN READ ONLY');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        const r = await c.query(`SELECT ${cols} FROM external_context_observations WHERE organization_id=$1 AND client_mutation_id=$2`, [actor.organizationId, clientMutationId]);
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
    async attempt(actor, input, clientMutationId) { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        if (clientMutationId) {
            const prior = await c.query(`SELECT ${cols} FROM external_context_observations WHERE organization_id=$1 AND client_mutation_id=$2`, [actor.organizationId, clientMutationId]);
            if (prior.rows[0]) {
                await c.query('COMMIT');
                return same(prior.rows[0], input) ? { kind: 'replayed', observation: map(prior.rows[0]) } : { kind: 'mutation_conflict' };
            }
        }
        const inserted = await c.query(`INSERT INTO external_context_observations (organization_id,client_mutation_id,administrative_area_code,metric_code,value,unit,period_start,period_end,source_label,source_uri,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${cols}`, [actor.organizationId, clientMutationId ?? null, input.administrativeAreaCode, input.metricCode, input.value, input.unit, input.periodStart, input.periodEnd, input.sourceLabel, input.sourceUri ?? null, actor.userId]);
        const row = inserted.rows[0];
        if (!row)
            throw new Error('Context observation insert returned no row');
        await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'external_context.recorded','external_context_observation',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, row.id, JSON.stringify({ administrativeAreaCode: input.administrativeAreaCode, metricCode: input.metricCode, unit: input.unit })]);
        await c.query('COMMIT');
        return { kind: 'created', observation: map(row) };
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
    async list(actor, filter, limit) { const c = await this.pool.connect(); try {
        await c.query('BEGIN READ ONLY');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        const rows = await c.query(`SELECT ${cols} FROM external_context_observations WHERE organization_id=$1 AND ($2::text IS NULL OR administrative_area_code=$2) AND ($3::text IS NULL OR metric_code=$3) ORDER BY period_end DESC, created_at DESC LIMIT $4`, [actor.organizationId, filter.areaCode ?? null, filter.metricCode ?? null, limit]);
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
    async forSignal(actor, signalId) { const c = await this.pool.connect(); try {
        await c.query('BEGIN READ ONLY');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        const s = await c.query('SELECT administrative_area_code, observed_at FROM signals WHERE organization_id=$1 AND id=$2', [actor.organizationId, signalId]);
        const sig = s.rows[0];
        if (!sig) {
            await c.query('COMMIT');
            return null;
        }
        const window = contextWindowFor(new Date(sig.observed_at).toISOString());
        const inWindow = await c.query(`SELECT ${cols} FROM external_context_observations WHERE organization_id=$1 AND administrative_area_code=$2 AND period_end >= $3::date AND period_start <= $4::date ORDER BY period_start DESC, created_at DESC LIMIT 200`, [actor.organizationId, sig.administrative_area_code, window.from, window.to]);
        const metrics = [...new Set(inWindow.rows.map(r => r.metric_code))];
        const baseline = metrics.length === 0 ? { rows: [] } : await c.query(`SELECT ${cols} FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY metric_code, unit ORDER BY period_end DESC, created_at DESC) AS rn FROM external_context_observations WHERE organization_id=$1 AND administrative_area_code=$2 AND period_end < $3::date AND metric_code = ANY($4::text[])) t WHERE rn<=$5`, [actor.organizationId, sig.administrative_area_code, window.from, metrics, CONTEXT_BASELINE_PERIODS]);
        await c.query('COMMIT');
        const toValue = (r) => ({ metricCode: r.metric_code, unit: r.unit, value: Number(r.value) });
        return { signalId, administrativeAreaCode: sig.administrative_area_code, window, observations: inWindow.rows.map(map), comparisons: compareContextToBaseline(inWindow.rows.map(toValue), baseline.rows.map(toValue)) };
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
