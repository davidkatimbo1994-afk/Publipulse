const columns = 'id, organization_id, signal_id, owner_user_id, status, findings, uncertainty_note, version, opened_at, closed_at';
function map(row) { return { id: row.id, organizationId: row.organization_id, signalId: row.signal_id, ownerUserId: row.owner_user_id, status: row.status, findings: row.findings, uncertaintyNote: row.uncertainty_note, version: row.version, openedAt: new Date(row.opened_at).toISOString(), closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null }; }
export class PostgresInvestigationStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async create(actor, signalId, input) {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const signal = await c.query('SELECT id FROM signals WHERE organization_id=$1 AND id=$2 FOR KEY SHARE', [actor.organizationId, signalId]);
            if (!signal.rows[0]) {
                await c.query('ROLLBACK');
                return { kind: 'signal_not_found' };
            }
            const membership = await c.query('SELECT user_id FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 AND active=true', [actor.organizationId, input.ownerUserId]);
            if (!membership.rows[0]) {
                await c.query('ROLLBACK');
                return { kind: 'invalid_owner' };
            }
            const result = await c.query(`INSERT INTO investigations (organization_id, signal_id, owner_user_id, findings) VALUES ($1,$2,$3,$4) RETURNING ${columns}`, [actor.organizationId, signalId, input.ownerUserId, input.initialNote ?? null]);
            const row = result.rows[0];
            if (!row)
                throw new Error('Investigation insert returned no row');
            await c.query("INSERT INTO audit_events (organization_id, actor_user_id, action, resource_type, resource_id, outcome, metadata) VALUES ($1,$2,'investigation.created','investigation',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, row.id, JSON.stringify({ signalId, ownerUserId: input.ownerUserId, hasInitialNote: Boolean(input.initialNote) })]);
            await c.query('COMMIT');
            return { kind: 'created', investigation: map(row) };
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
        }
    }
    async list(actor, signalId, limit) {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN READ ONLY');
            await c.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const signal = await c.query('SELECT id FROM signals WHERE organization_id=$1 AND id=$2', [actor.organizationId, signalId]);
            if (!signal.rows[0]) {
                await c.query('COMMIT');
                return null;
            }
            const result = await c.query(`SELECT ${columns} FROM investigations WHERE organization_id=$1 AND signal_id=$2 ORDER BY opened_at DESC LIMIT $3`, [actor.organizationId, signalId, limit]);
            await c.query('COMMIT');
            return result.rows.map(map);
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
        }
    }
    async update(actor, id, input) {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const current = await c.query(`SELECT ${columns} FROM investigations WHERE organization_id=$1 AND id=$2 FOR UPDATE`, [actor.organizationId, id]);
            const old = current.rows[0];
            if (!old) {
                await c.query('ROLLBACK');
                return { kind: 'not_found' };
            }
            if (!actor.roles.some((role) => ['owner', 'administrator', 'reviewer'].includes(role)) && !(actor.roles.includes('investigator') && old.owner_user_id === actor.userId)) {
                await c.query('ROLLBACK');
                return { kind: 'forbidden' };
            }
            if (old.version !== input.expectedVersion) {
                await c.query('ROLLBACK');
                return { kind: 'conflict' };
            }
            if ((old.status === 'completed' || old.status === 'cancelled') && (input.status !== undefined || input.findings !== undefined || input.uncertaintyNote !== undefined)) {
                await c.query('ROLLBACK');
                return { kind: 'conflict' };
            }
            const nextStatus = input.status ?? old.status;
            const closed = nextStatus === 'completed' || nextStatus === 'cancelled';
            const result = await c.query(`UPDATE investigations SET status=$3, findings=$4, uncertainty_note=$5, closed_at=CASE WHEN $6 THEN COALESCE(closed_at, now()) ELSE NULL END, version=version+1 WHERE organization_id=$1 AND id=$2 RETURNING ${columns}`, [actor.organizationId, id, nextStatus, input.findings === undefined ? old.findings : input.findings, input.uncertaintyNote === undefined ? old.uncertainty_note : input.uncertaintyNote, closed]);
            const row = result.rows[0];
            if (!row)
                throw new Error('Investigation update returned no row');
            await c.query("INSERT INTO audit_events (organization_id, actor_user_id, action, resource_type, resource_id, outcome, metadata) VALUES ($1,$2,'investigation.updated','investigation',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, id, JSON.stringify({ previousStatus: old.status, status: row.status, previousVersion: old.version, version: row.version, findingsChanged: input.findings !== undefined, uncertaintyChanged: input.uncertaintyNote !== undefined })]);
            await c.query('COMMIT');
            return { kind: 'updated', investigation: map(row) };
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
        }
    }
}
