const cols = 'id,organization_id,action_id,event_type,from_user_id,to_user_id,occurred_at,note,recorded_by';
const map = (r) => ({ id: r.id, organizationId: r.organization_id, actionId: r.action_id, eventType: r.event_type, fromUserId: r.from_user_id, toUserId: r.to_user_id, occurredAt: new Date(r.occurred_at).toISOString(), note: r.note, recordedBy: r.recorded_by });
const managers = ['owner', 'administrator', 'reviewer'];
export class PostgresActionHandoffStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async begin(actor, readOnly = false) { const c = await this.pool.connect(); try {
        await c.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        return c;
    }
    catch (e) {
        try {
            await c.query('ROLLBACK');
        }
        catch { }
        c.release();
        throw e;
    } }
    async append(actor, actionId, eventType, toUserId, note) {
        const c = await this.begin(actor);
        let failed = false;
        try {
            const action = await c.query('SELECT id,owner_user_id FROM response_actions WHERE organization_id=$1 AND id=$2 FOR UPDATE', [actor.organizationId, actionId]);
            const a = action.rows[0];
            if (!a) {
                await c.query('ROLLBACK');
                return { kind: 'action_not_found' };
            }
            const latest = await c.query(`SELECT ${cols} FROM action_handoff_events WHERE organization_id=$1 AND action_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 1 FOR UPDATE`, [actor.organizationId, actionId]);
            const prev = latest.rows[0];
            const manager = actor.roles.some(r => managers.includes(r));
            if (eventType === 'initiated') {
                if (!toUserId || toUserId === actor.userId || prev?.event_type === 'initiated') {
                    await c.query('ROLLBACK');
                    return { kind: 'invalid_transition' };
                }
                const member = await c.query('SELECT user_id FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 AND active=true FOR KEY SHARE', [actor.organizationId, toUserId]);
                if (!member.rows[0]) {
                    await c.query('ROLLBACK');
                    return { kind: 'recipient_not_active' };
                }
            }
            else {
                if (!prev || prev.event_type !== 'initiated' || !prev.to_user_id) {
                    await c.query('ROLLBACK');
                    return { kind: 'invalid_transition' };
                }
                if (eventType === 'accepted' || eventType === 'declined') {
                    if (prev.to_user_id !== actor.userId) {
                        await c.query('ROLLBACK');
                        return { kind: 'invalid_transition' };
                    }
                }
                if (eventType === 'cancelled' && prev.from_user_id !== actor.userId && !manager) {
                    await c.query('ROLLBACK');
                    return { kind: 'invalid_transition' };
                }
            }
            const from = eventType === 'initiated' ? actor.userId : (prev?.from_user_id ?? a.owner_user_id);
            const recipient = eventType === 'initiated' ? toUserId : (prev?.to_user_id ?? toUserId);
            const ins = await c.query(`INSERT INTO action_handoff_events(organization_id,action_id,event_type,from_user_id,to_user_id,note,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${cols}`, [actor.organizationId, actionId, eventType, from, recipient, note, actor.userId]);
            const row = ins.rows[0];
            if (!row)
                throw new Error('Handoff event insert returned no row');
            await c.query("INSERT INTO audit_events(organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,$3,'response_action',$4,'success',$5::jsonb)", [actor.organizationId, actor.userId, `action_handoff.${eventType}`, actionId, JSON.stringify({ eventId: row.id, toUserId: row.to_user_id })]);
            await c.query('COMMIT');
            return { kind: 'created', event: map(row) };
        }
        catch (e) {
            failed = true;
            try {
                await c.query('ROLLBACK');
            }
            catch { }
            throw e;
        }
        finally {
            try {
                c.release();
            }
            catch (e) {
                if (!failed)
                    throw e;
            }
        }
    }
    async list(actor, actionId, limit) { const c = await this.begin(actor, true); let failed = false; try {
        const action = await c.query('SELECT id FROM response_actions WHERE organization_id=$1 AND id=$2', [actor.organizationId, actionId]);
        if (!action.rows[0]) {
            await c.query('COMMIT');
            return null;
        }
        const r = await c.query(`SELECT ${cols} FROM action_handoff_events WHERE organization_id=$1 AND action_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT $3`, [actor.organizationId, actionId, limit]);
        await c.query('COMMIT');
        return r.rows.map(map);
    }
    catch (e) {
        failed = true;
        try {
            await c.query('ROLLBACK');
        }
        catch { }
        throw e;
    }
    finally {
        try {
            c.release();
        }
        catch (e) {
            if (!failed)
                throw e;
        }
    } }
}
