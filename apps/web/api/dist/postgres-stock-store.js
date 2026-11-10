import { buildSeriesForecast } from '@publipulse/shared';
const cols = 'id, organization_id, administrative_area_code, commodity_code, unit, quantity_on_hand, quantity_received, observed_at, recorded_by, created_at';
const iso = (v) => new Date(v).toISOString();
const map = (r) => ({ id: r.id, organizationId: r.organization_id, administrativeAreaCode: r.administrative_area_code, commodityCode: r.commodity_code, unit: r.unit, quantityOnHand: Number(r.quantity_on_hand), quantityReceived: Number(r.quantity_received), observedAt: iso(r.observed_at), recordedBy: r.recorded_by, createdAt: iso(r.created_at) });
/** Snapshots per series used for the forecast: enough for several intervals, bounded so old history cannot dominate. */
export const STOCK_FORECAST_WINDOW = 6;
const cents = (n) => Math.round(n * 100);
const same = (r, i) => r.administrative_area_code === i.administrativeAreaCode && r.commodity_code === i.commodityCode && r.unit === i.unit && cents(Number(r.quantity_on_hand)) === cents(i.quantityOnHand) && cents(Number(r.quantity_received)) === cents(i.quantityReceived) && Date.parse(iso(r.observed_at)) === Date.parse(i.observedAt);
export class PostgresStockStore {
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
                return same(prior, input) ? { kind: 'replayed', snapshot: map(prior) } : { kind: 'mutation_conflict' };
        }
        throw e;
    } }
    async findByMutation(actor, clientMutationId) { const c = await this.pool.connect(); try {
        await c.query('BEGIN READ ONLY');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        const r = await c.query(`SELECT ${cols} FROM commodity_stock_snapshots WHERE organization_id=$1 AND client_mutation_id=$2`, [actor.organizationId, clientMutationId]);
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
            const prior = await c.query(`SELECT ${cols} FROM commodity_stock_snapshots WHERE organization_id=$1 AND client_mutation_id=$2`, [actor.organizationId, clientMutationId]);
            if (prior.rows[0]) {
                await c.query('COMMIT');
                return same(prior.rows[0], input) ? { kind: 'replayed', snapshot: map(prior.rows[0]) } : { kind: 'mutation_conflict' };
            }
        }
        const inserted = await c.query(`INSERT INTO commodity_stock_snapshots (organization_id,client_mutation_id,administrative_area_code,commodity_code,unit,quantity_on_hand,quantity_received,observed_at,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${cols}`, [actor.organizationId, clientMutationId ?? null, input.administrativeAreaCode, input.commodityCode, input.unit, input.quantityOnHand, input.quantityReceived, input.observedAt, actor.userId]);
        const row = inserted.rows[0];
        if (!row)
            throw new Error('Stock snapshot insert returned no row');
        await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'stock_snapshot.recorded','stock_snapshot',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, row.id, JSON.stringify({ administrativeAreaCode: input.administrativeAreaCode, commodityCode: input.commodityCode, unit: input.unit })]);
        await c.query('COMMIT');
        return { kind: 'created', snapshot: map(row) };
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
    async forecast(actor, limit, leadTimeDays, now) { const c = await this.pool.connect(); try {
        await c.query('BEGIN READ ONLY');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        const rows = await c.query(`WITH recent AS (SELECT administrative_area_code, commodity_code, unit FROM commodity_stock_snapshots WHERE organization_id=$1 GROUP BY administrative_area_code, commodity_code, unit ORDER BY MAX(observed_at) DESC LIMIT $2), ranked AS (SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.administrative_area_code, s.commodity_code, s.unit ORDER BY s.observed_at DESC, s.created_at DESC) AS rn FROM commodity_stock_snapshots s JOIN recent r ON r.administrative_area_code=s.administrative_area_code AND r.commodity_code=s.commodity_code AND r.unit=s.unit WHERE s.organization_id=$1) SELECT ${cols} FROM ranked WHERE rn<=$3`, [actor.organizationId, limit, STOCK_FORECAST_WINDOW]);
        await c.query('COMMIT');
        const groups = new Map();
        for (const r of rows.rows) {
            const k = `${r.administrative_area_code}\u0000${r.commodity_code}\u0000${r.unit}`;
            const g = groups.get(k) ?? [];
            g.push(r);
            groups.set(k, g);
        }
        const order = { critical: 0, warning: 1, ok: 2, insufficient_data: 3 };
        return [...groups.values()].map(g => { const f = g[0]; return buildSeriesForecast({ administrativeAreaCode: f.administrative_area_code, commodityCode: f.commodity_code, unit: f.unit, points: g.map(r => ({ quantityOnHand: Number(r.quantity_on_hand), quantityReceived: Number(r.quantity_received), observedAt: iso(r.observed_at) })) }, { now, leadTimeDays }); }).sort((a, b) => order[a.level] - order[b.level] || (a.daysOfStockLeft ?? Infinity) - (b.daysOfStockLeft ?? Infinity));
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
