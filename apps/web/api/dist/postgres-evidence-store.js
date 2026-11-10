function mapEvidence(row) {
    return {
        id: row.id, organizationId: row.organization_id, signalId: row.signal_id, submittedBy: row.submitted_by,
        evidenceType: row.evidence_type, description: row.description, sourceLabel: row.source_label,
        ...(row.source_uri ? { sourceUri: row.source_uri } : {}),
        ...(row.observed_at ? { observedAt: new Date(row.observed_at).toISOString() } : {}),
        status: row.status, createdAt: new Date(row.created_at).toISOString()
    };
}
const columns = 'id, organization_id, signal_id, submitted_by, evidence_type, description, source_label, source_uri, observed_at, status, created_at';
export class PostgresEvidenceStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async create(actor, signalId, input) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const signal = await connection.query('SELECT id FROM signals WHERE organization_id = $1 AND id = $2 FOR KEY SHARE', [actor.organizationId, signalId]);
            if (!signal.rows[0]) {
                await connection.query('ROLLBACK');
                return { kind: 'signal_not_found' };
            }
            const result = await connection.query(`INSERT INTO evidence (organization_id, signal_id, submitted_by, evidence_type, description, source_label, source_uri, observed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${columns}`, [actor.organizationId, signalId, actor.userId, input.evidenceType, input.description, input.sourceLabel, input.sourceUri ?? null, input.observedAt ?? null]);
            const row = result.rows[0];
            if (!row)
                throw new Error('Evidence insert returned no row');
            const evidence = mapEvidence(row);
            await connection.query(`INSERT INTO audit_events (organization_id, actor_user_id, action, resource_type, resource_id, outcome, metadata)
         VALUES ($1,$2,'evidence.created','evidence',$3,'success',$4::jsonb)`, [actor.organizationId, actor.userId, evidence.id, JSON.stringify({ signalId, evidenceType: input.evidenceType, hasSourceUri: Boolean(input.sourceUri) })]);
            await connection.query('COMMIT');
            return { kind: 'created', evidence };
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
    async list(actor, signalId, limit) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN READ ONLY');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const signal = await connection.query('SELECT id FROM signals WHERE organization_id = $1 AND id = $2', [actor.organizationId, signalId]);
            if (!signal.rows[0]) {
                await connection.query('COMMIT');
                return null;
            }
            const result = await connection.query(`SELECT ${columns} FROM evidence WHERE organization_id = $1 AND signal_id = $2 ORDER BY created_at DESC LIMIT $3`, [actor.organizationId, signalId, limit]);
            await connection.query('COMMIT');
            return result.rows.map(mapEvidence);
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
