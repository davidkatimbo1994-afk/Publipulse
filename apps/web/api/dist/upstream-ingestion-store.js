function map(row) {
    return { id: row.id, organizationId: row.organization_id, submittedBy: row.submitted_by, clientSubmissionId: row.client_submission_id, category: row.category, summary: row.summary, sourceType: row.source_type, observedAt: new Date(row.observed_at).toISOString(), location: { administrativeAreaCode: row.administrative_area_code, precision: row.location_precision }, status: row.status, version: Number(row.version), createdAt: new Date(row.created_at).toISOString() };
}
export class PostgresUpstreamIngestionStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async ingest(actor, input) {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
            const profile = await c.query(`SELECT id,provider,status FROM integration_profiles WHERE organization_id=$1 AND id=$2 FOR SHARE`, [actor.organizationId, input.integrationProfileId]);
            if (!profile.rows[0] || profile.rows[0].provider !== input.provider || profile.rows[0].status !== 'verified') {
                await c.query('ROLLBACK');
                return { kind: 'profile_missing' };
            }
            // Serialize the same upstream identity inside the transaction so two concurrent retries
            // cannot create two PubliPulse signals for one external event.
            await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`publipulse:upstream:${actor.organizationId}:${input.integrationProfileId}:${input.provider}:${input.externalEventId}`]);
            const prior = await c.query(`SELECT signal_id FROM upstream_event_receipts WHERE organization_id=$1 AND integration_profile_id=$2 AND provider=$3 AND external_event_id=$4 FOR SHARE`, [actor.organizationId, input.integrationProfileId, input.provider, input.externalEventId]);
            if (prior.rows[0]) {
                const existing = await c.query(`SELECT id,organization_id,submitted_by,client_submission_id,category,summary,source_type,observed_at,administrative_area_code,location_precision,status,version,created_at FROM signals WHERE organization_id=$1 AND id=$2`, [actor.organizationId, prior.rows[0].signal_id]);
                if (!existing.rows[0]) {
                    await c.query('ROLLBACK');
                    return { kind: 'conflict' };
                }
                await c.query(`INSERT INTO audit_events(organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'interoperability.upstream_event_replayed','signal',$3,'success',$4::jsonb)`, [actor.organizationId, actor.userId, prior.rows[0].signal_id, JSON.stringify({ provider: input.provider, externalEventId: input.externalEventId, integrationProfileId: input.integrationProfileId })]);
                await c.query('COMMIT');
                return { kind: 'replayed', signal: map(existing.rows[0]) };
            }
            const inserted = await c.query(`INSERT INTO signals(organization_id,submitted_by,client_submission_id,category,summary,source_type,observed_at,administrative_area_code,location_precision) VALUES($1,$2,gen_random_uuid(),$3,$4,$5,$6,$7,$8) RETURNING id,organization_id,submitted_by,client_submission_id,category,summary,source_type,observed_at,administrative_area_code,location_precision,status,version,created_at`, [actor.organizationId, actor.userId, input.category, input.summary, input.sourceType, input.observedAt, input.location.administrativeAreaCode, input.location.precision]);
            const insertedRow = inserted.rows[0];
            if (!insertedRow)
                throw new Error('Upstream signal insert returned no row');
            const signal = map(insertedRow);
            await c.query(`INSERT INTO upstream_event_receipts(organization_id,integration_profile_id,provider,external_event_id,contract_version,signal_id,received_by) VALUES($1,$2,$3,$4,$5,$6,$7)`, [actor.organizationId, input.integrationProfileId, input.provider, input.externalEventId, input.contractVersion, signal.id, actor.userId]);
            await c.query(`INSERT INTO audit_events(organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'interoperability.upstream_event_ingested','signal',$3,'success',$4::jsonb)`, [actor.organizationId, actor.userId, signal.id, JSON.stringify({ provider: input.provider, externalEventId: input.externalEventId, integrationProfileId: input.integrationProfileId, contractVersion: input.contractVersion })]);
            await c.query('COMMIT');
            return { kind: 'created', signal };
        }
        catch (error) {
            try {
                await c.query('ROLLBACK');
            }
            catch { }
            throw error;
        }
        finally {
            c.release();
        }
    }
}
