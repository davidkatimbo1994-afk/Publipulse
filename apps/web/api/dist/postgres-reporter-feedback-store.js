export class PostgresReporterFeedbackStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async append(actor, input) {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
            if (input.clientMutationId) {
                const prior = await c.query(`SELECT id FROM reporter_feedback_events WHERE organization_id=$1 AND client_mutation_id=$2`, [actor.organizationId, input.clientMutationId]);
                if (prior.rows[0]) {
                    await c.query('COMMIT');
                    return { kind: 'replayed' };
                }
            }
            const inserted = await c.query(`INSERT INTO reporter_feedback_events(organization_id,signal_id,client_mutation_id,source_type,feedback_stage,delivery_channel,delivery_status,delivered_at,non_identifying_message,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [actor.organizationId, input.signalId, input.clientMutationId ?? null, input.sourceType, input.feedbackStage, input.deliveryChannel, input.deliveryStatus, input.deliveredAt ?? null, input.nonIdentifyingMessage, actor.userId]);
            const row = inserted.rows[0];
            if (!row)
                throw new Error('reporter feedback insert returned no row');
            await c.query(`INSERT INTO audit_events(organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) SELECT $1,$2,'reporter_feedback.appended','signal',s.id,'success',$3::jsonb FROM signals s WHERE s.organization_id=$1 AND s.id=$4`, [actor.organizationId, actor.userId, JSON.stringify({ stage: input.feedbackStage, channel: input.deliveryChannel, status: input.deliveryStatus }), input.signalId]);
            await c.query('COMMIT');
            return { kind: 'created' };
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
    async recordDeliveryAttempt(actor, input) {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
            await c.query(`INSERT INTO reporter_feedback_delivery_attempts(organization_id,feedback_event_id,attempt_no,status,provider_reference,error_class,delivered_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, [actor.organizationId, input.feedbackEventId, input.attemptNo, input.status, input.providerReference ?? null, input.errorClass ?? null, input.deliveredAt ?? null]);
            await c.query('COMMIT');
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
