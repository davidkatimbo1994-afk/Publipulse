export class PostgresAuditStore {
    pool;
    constructor(pool) { this.pool = pool; }
    async list(actor, limit, cursor) {
        const client = await this.pool.connect();
        let failure;
        try {
            await client.query('BEGIN');
            await client.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const result = cursor
                ? await client.query(`SELECT id::text, actor_user_id::text, action, resource_type, resource_id::text, outcome, occurred_at FROM audit_events WHERE organization_id = $1 AND (occurred_at, id) < ($2::timestamptz, $3::bigint) ORDER BY occurred_at DESC, id DESC LIMIT $4`, [actor.organizationId, cursor.occurredAt, cursor.id, limit])
                : await client.query(`SELECT id::text, actor_user_id::text, action, resource_type, resource_id::text, outcome, occurred_at FROM audit_events WHERE organization_id = $1 ORDER BY occurred_at DESC, id DESC LIMIT $2`, [actor.organizationId, limit]);
            await client.query('COMMIT');
            return result.rows.map((row) => ({ id: String(row.id), actorUserId: row.actor_user_id == null ? null : String(row.actor_user_id), action: String(row.action), resourceType: String(row.resource_type), resourceId: row.resource_id == null ? null : String(row.resource_id), outcome: row.outcome, occurredAt: new Date(String(row.occurred_at)).toISOString() }));
        }
        catch (error) {
            failure = error;
            try {
                await client.query('ROLLBACK');
            }
            catch { /* preserve primary query error */ }
            throw error;
        }
        finally {
            try {
                client.release();
            }
            catch (releaseError) {
                if (failure === undefined)
                    throw releaseError;
            }
        }
    }
}
