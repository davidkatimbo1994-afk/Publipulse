import { isAllowedSignalTransition } from './signal-store.js';
function mapSignal(row) {
    return {
        id: row.id,
        organizationId: row.organization_id,
        submittedBy: row.submitted_by,
        clientSubmissionId: row.client_submission_id,
        category: row.category,
        summary: row.summary,
        sourceType: row.source_type,
        observedAt: new Date(row.observed_at).toISOString(),
        location: { administrativeAreaCode: row.administrative_area_code, precision: row.location_precision },
        status: row.status,
        version: Number(row.version),
        createdAt: new Date(row.created_at).toISOString()
    };
}
function sameIntake(row, input) {
    return row.clientSubmissionId === input.clientSubmissionId
        && row.category === input.category
        && row.summary === input.summary
        && row.sourceType === input.sourceType
        && row.observedAt === new Date(input.observedAt).toISOString()
        && row.location.administrativeAreaCode === input.location.administrativeAreaCode
        && row.location.precision === input.location.precision;
}
/**
 * PostgreSQL adapter. Caller must supply a least-privilege, non-owner pool role.
 * Tenant scope is set transaction-locally and all writes are transactionally audited.
 */
export class PostgresSignalStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async createIdempotent(actor, input) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const inserted = await connection.query(`INSERT INTO signals
          (organization_id, submitted_by, client_submission_id, category, summary, source_type, observed_at, administrative_area_code, location_precision)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (organization_id, submitted_by, client_submission_id) DO NOTHING
         RETURNING id, organization_id, submitted_by, client_submission_id, category, summary, source_type, observed_at, administrative_area_code, location_precision, status, version, created_at`, [actor.organizationId, actor.userId, input.clientSubmissionId, input.category, input.summary, input.sourceType,
                input.observedAt, input.location.administrativeAreaCode, input.location.precision]);
            if (inserted.rows[0]) {
                const row = mapSignal(inserted.rows[0]);
                await connection.query(`INSERT INTO audit_events (organization_id, actor_user_id, action, resource_type, resource_id, outcome, metadata)
           VALUES ($1,$2,'signal.created','signal',$3,'success',$4::jsonb)`, [actor.organizationId, actor.userId, row.id, JSON.stringify({ sourceType: input.sourceType, category: input.category })]);
                await connection.query('COMMIT');
                return { kind: 'created', signal: row };
            }
            const existing = await connection.query(`SELECT id, organization_id, submitted_by, client_submission_id, category, summary, source_type, observed_at, administrative_area_code, location_precision, status, version, created_at
         FROM signals WHERE organization_id = $1 AND submitted_by = $2 AND client_submission_id = $3`, [actor.organizationId, actor.userId, input.clientSubmissionId]);
            const row = existing.rows[0] ? mapSignal(existing.rows[0]) : null;
            if (!row || !sameIntake(row, input)) {
                await connection.query(`INSERT INTO audit_events (organization_id, actor_user_id, action, resource_type, resource_id, outcome, metadata)
           VALUES ($1,$2,'signal.idempotency_conflict','signal',$3,'failure','{"idempotent":false}'::jsonb)`, [actor.organizationId, actor.userId, row?.id ?? null]);
                await connection.query('COMMIT');
                return { kind: 'conflict' };
            }
            await connection.query(`INSERT INTO audit_events (organization_id, actor_user_id, action, resource_type, resource_id, outcome, metadata)
         VALUES ($1,$2,'signal.replayed','signal',$3,'success','{"idempotent":true}'::jsonb)`, [actor.organizationId, actor.userId, row.id]);
            await connection.query('COMMIT');
            return { kind: 'replayed', signal: row };
        }
        catch (error) {
            try {
                await connection.query('ROLLBACK');
            }
            catch { /* Preserve the original error. */ }
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async listForOrganization(organizationId, limit) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN READ ONLY');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
            const result = await connection.query(`SELECT id, organization_id, submitted_by, client_submission_id, category, summary, source_type, observed_at, administrative_area_code, location_precision, status, version, created_at
         FROM signals WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`, [organizationId, limit]);
            await connection.query('COMMIT');
            return result.rows.map(mapSignal);
        }
        catch (error) {
            try {
                await connection.query('ROLLBACK');
            }
            catch { /* Preserve the original error. */ }
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async recordMilestone(actor, signalId, milestone) {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
            const q = await c.query(`SELECT id FROM signals WHERE organization_id=$1 AND id=$2 FOR KEY SHARE`, [actor.organizationId, signalId]);
            if (!q.rows[0]) {
                await c.query('ROLLBACK');
                return 'not_found';
            }
            await c.query(`INSERT INTO audit_events(organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,$3,'signal',$4,'success','{}'::jsonb)`, [actor.organizationId, actor.userId, `signal.${milestone}`, signalId]);
            await c.query('COMMIT');
            return 'recorded';
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
    async transitionStatus(actor, signalId, expectedVersion, nextStatus) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const currentResult = await connection.query(`SELECT id, organization_id, submitted_by, client_submission_id, category, summary, source_type, observed_at, administrative_area_code, location_precision, status, version, created_at
         FROM signals WHERE organization_id = $1 AND id = $2 FOR UPDATE`, [actor.organizationId, signalId]);
            const current = currentResult.rows[0] ? mapSignal(currentResult.rows[0]) : null;
            if (!current) {
                await connection.query('ROLLBACK');
                return { kind: 'not_found' };
            }
            if (current.version !== expectedVersion) {
                await connection.query('ROLLBACK');
                return { kind: 'conflict' };
            }
            if (!isAllowedSignalTransition(current.status, nextStatus)) {
                await connection.query('ROLLBACK');
                return { kind: 'invalid_transition', currentStatus: current.status };
            }
            const updatedResult = await connection.query(`UPDATE signals SET status = $3, version = version + 1, updated_at = now()
         WHERE organization_id = $1 AND id = $2 AND version = $4
         RETURNING id, organization_id, submitted_by, client_submission_id, category, summary, source_type, observed_at, administrative_area_code, location_precision, status, version, created_at`, [actor.organizationId, signalId, nextStatus, expectedVersion]);
            const updated = updatedResult.rows[0] ? mapSignal(updatedResult.rows[0]) : null;
            if (!updated) {
                await connection.query('ROLLBACK');
                return { kind: 'conflict' };
            }
            await connection.query(`INSERT INTO audit_events (organization_id, actor_user_id, action, resource_type, resource_id, outcome, metadata)
         VALUES ($1,$2,'signal.status_changed','signal',$3,'success',$4::jsonb)`, [actor.organizationId, actor.userId, signalId, JSON.stringify({ from: current.status, to: nextStatus, version: updated.version })]);
            await connection.query('COMMIT');
            return { kind: 'updated', signal: updated };
        }
        catch (error) {
            try {
                await connection.query('ROLLBACK');
            }
            catch { /* Preserve the original error. */ }
            throw error;
        }
        finally {
            connection.release();
        }
    }
}
