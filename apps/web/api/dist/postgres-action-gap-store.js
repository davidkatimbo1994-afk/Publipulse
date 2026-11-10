const cols = 'id,organization_id,signal_id,rule_code,rule_version,severity,explanation,supporting_evidence,recommended_next_step,status,detected_at,reviewed_by,reviewed_at,review_note';
const iso = (v) => v === null ? null : new Date(v).toISOString();
const map = (r) => ({ id: r.id, organizationId: r.organization_id, signalId: r.signal_id, ruleCode: r.rule_code, ruleVersion: r.rule_version, severity: r.severity, explanation: r.explanation, supportingEvidence: r.supporting_evidence, recommendedNextStep: r.recommended_next_step, status: r.status, detectedAt: iso(r.detected_at), reviewedBy: r.reviewed_by, reviewedAt: iso(r.reviewed_at), reviewNote: r.review_note });
export class PostgresActionGapStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async create(actor, input) { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        const s = await c.query('SELECT id FROM signals WHERE organization_id=$1 AND id=$2 FOR KEY SHARE', [actor.organizationId, input.signalId]);
        if (!s.rows[0]) {
            await c.query('ROLLBACK');
            return { kind: 'signal_not_found' };
        }
        const workflowCaseId = typeof input.supportingEvidence.workflowCaseId === 'string' ? input.supportingEvidence.workflowCaseId : 'signal';
        const fingerprint = [input.signalId, workflowCaseId, input.ruleCode, input.ruleVersion].join(':');
        const q = await c.query(`INSERT INTO action_gap_detections(organization_id,signal_id,rule_code,rule_version,severity,explanation,supporting_evidence,recommended_next_step,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) ON CONFLICT (organization_id,fingerprint) WHERE fingerprint IS NOT NULL DO NOTHING RETURNING ${cols}`, [actor.organizationId, input.signalId, input.ruleCode, input.ruleVersion, input.severity, input.explanation, JSON.stringify(input.supportingEvidence), input.recommendedNextStep, fingerprint]);
        let row = q.rows[0];
        if (!row) {
            const existing = await c.query(`SELECT ${cols} FROM action_gap_detections WHERE organization_id=$1 AND fingerprint=$2 FOR UPDATE`, [actor.organizationId, fingerprint]);
            row = existing.rows[0];
            if (!row)
                throw new Error('Idempotent gap lookup returned no row');
            await c.query('COMMIT');
            return { kind: 'existing', detection: map(row) };
        }
        await c.query("INSERT INTO audit_events(organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'action_gap.detected','action_gap_detection',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, row.id, JSON.stringify({ signalId: input.signalId, ruleCode: input.ruleCode, ruleVersion: input.ruleVersion, severity: input.severity })]);
        await c.query('COMMIT');
        return { kind: 'created', detection: map(row) };
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
    async list(actor, limit, status) { const c = await this.pool.connect(); try {
        await c.query('BEGIN READ ONLY');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        const q = await c.query(`SELECT ${cols} FROM action_gap_detections WHERE organization_id=$1 AND ($2::text IS NULL OR status=$2) ORDER BY detected_at DESC LIMIT $3`, [actor.organizationId, status ?? null, limit]);
        await c.query('COMMIT');
        return q.rows.map(map);
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
    async reconcileEvaluatedCase(actor, signalId, workflowCaseId, activeFingerprints) {
        // Call only after a complete, tenant-scoped evaluation and successful persistence of every active finding.
        const c = await this.pool.connect();
        let resolved = 0;
        try {
            await c.query('BEGIN');
            await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
            const signal = await c.query('SELECT id FROM signals WHERE organization_id=$1 AND id=$2 FOR KEY SHARE', [actor.organizationId, signalId]);
            if (!signal.rows[0]) {
                await c.query('ROLLBACK');
                return 0;
            }
            const q = await c.query(`SELECT ${cols},fingerprint FROM action_gap_detections WHERE organization_id=$1 AND signal_id=$2 AND COALESCE(supporting_evidence->>'workflowCaseId','signal')=$3 AND status='open' AND reviewed_by IS NULL AND reviewed_at IS NULL AND fingerprint IS NOT NULL ORDER BY id FOR UPDATE SKIP LOCKED`, [actor.organizationId, signalId, workflowCaseId]);
            const active = new Set(activeFingerprints);
            for (const row of q.rows) {
                if (active.has(row.fingerprint ?? ''))
                    continue;
                const updated = await c.query("UPDATE action_gap_detections SET status='resolved' WHERE organization_id=$1 AND id=$2 AND status='open' AND reviewed_by IS NULL AND reviewed_at IS NULL RETURNING id", [actor.organizationId, row.id]);
                if (!updated.rows[0])
                    continue;
                await c.query("INSERT INTO audit_events(organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'action_gap.auto_resolved','action_gap_detection',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, row.id, JSON.stringify({ signalId, workflowCaseId, fingerprint: row.fingerprint, reason: 'finding_absent_after_complete_evaluation' })]);
                resolved++;
            }
            await c.query('COMMIT');
            return resolved;
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
    async review(actor, id, status, note, expectedStatus) { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        await c.query("SELECT set_config('app.organization_id',$1,true)", [actor.organizationId]);
        const q = await c.query(`UPDATE action_gap_detections SET status=$3,reviewed_by=$4,reviewed_at=now(),review_note=$5 WHERE organization_id=$1 AND id=$2 AND status=$6 RETURNING ${cols}`, [actor.organizationId, id, status, actor.userId, note, expectedStatus]);
        if (!q.rows[0]) {
            const exists = await c.query('SELECT id FROM action_gap_detections WHERE organization_id=$1 AND id=$2', [actor.organizationId, id]);
            await c.query('ROLLBACK');
            return exists.rows[0] ? { kind: 'conflict' } : { kind: 'not_found' };
        }
        const row = q.rows[0];
        await c.query("INSERT INTO audit_events(organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'action_gap.reviewed','action_gap_detection',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, id, JSON.stringify({ from: expectedStatus, to: status, hasNote: Boolean(note) })]);
        await c.query('COMMIT');
        return { kind: 'updated', detection: map(row) };
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
