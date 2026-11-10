import { buildWeeklyReviewSummary } from '@publipulse/shared/weekly-review';
const numberOf = (value) => Number(value);
function mapPattern(row, dimension) {
    return { dimension, key: row.key, signalCount: numberOf(row.signal_count), verifiedCount: numberOf(row.verified_count), completedActionCount: numberOf(row.completed_action_count), outcomeCount: numberOf(row.outcome_count), improvedOutcomeCount: numberOf(row.improved_outcome_count), inconclusiveOutcomeCount: numberOf(row.inconclusive_outcome_count), openGapCount: numberOf(row.open_gap_count) };
}
const metricSql = `
  SELECT COUNT(DISTINCT s.id)::int AS signal_count,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'verified')::int AS verified_count,
    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed')::int AS completed_action_count,
    COUNT(DISTINCT o.id)::int AS outcome_count,
    COUNT(DISTINCT o.id) FILTER (WHERE o.assessment_result = 'improved')::int AS improved_outcome_count,
    COUNT(DISTINCT o.id) FILTER (WHERE o.assessment_result = 'inconclusive')::int AS inconclusive_outcome_count,
    COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'open')::int AS open_gap_count
  FROM signals s
  LEFT JOIN response_actions a ON a.organization_id = s.organization_id AND a.signal_id = s.id
  LEFT JOIN outcomes o ON o.organization_id = s.organization_id AND o.signal_id = s.id
  LEFT JOIN action_gap_detections g ON g.organization_id = s.organization_id AND g.signal_id = s.id
  WHERE s.organization_id = $1 AND s.observed_at >= $2 AND s.observed_at < $3
`;
export class PostgresLearningStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async operationalPatterns(actor, from, to, minCell) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN READ ONLY');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const overallResult = await connection.query(metricSql, [actor.organizationId, from.toISOString(), to.toISOString()]);
            const overallRow = overallResult.rows[0];
            if (!overallRow)
                throw new Error('Learning aggregate returned no summary row');
            const categoryResult = await connection.query(`${metricSql} GROUP BY s.category HAVING COUNT(DISTINCT s.id) >= $4 ORDER BY signal_count DESC, s.category ASC`, [actor.organizationId, from.toISOString(), to.toISOString(), minCell]);
            const areaResult = await connection.query(`${metricSql} GROUP BY s.administrative_area_code HAVING COUNT(DISTINCT s.id) >= $4 ORDER BY signal_count DESC, s.administrative_area_code ASC`, [actor.organizationId, from.toISOString(), to.toISOString(), minCell]);
            await connection.query('COMMIT');
            return { from: from.toISOString(), to: to.toISOString(), minCell, overall: mapPattern({ ...overallRow, key: '' }, 'category'), patterns: [...categoryResult.rows.map(row => mapPattern(row, 'category')), ...areaResult.rows.map(row => mapPattern(row, 'administrative_area'))] };
        }
        catch (error) {
            try {
                await connection.query('ROLLBACK');
            }
            catch { }
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async outcomeDecay(actor, from, to, minCell) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN READ ONLY');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const funnel = await connection.query(`
        WITH base AS (
          SELECT s.id, s.category, s.administrative_area_code, s.created_at,
            (SELECT MIN(ae.occurred_at) FROM audit_events ae WHERE ae.organization_id=s.organization_id AND ae.resource_type='signal' AND ae.resource_id=s.id AND ae.action='signal.status_changed' AND ae.metadata->>'to'='verified' AND ae.occurred_at >= s.created_at) AS verified_at,
            (SELECT MIN(i.opened_at) FROM investigations i WHERE i.organization_id=s.organization_id AND i.signal_id=s.id AND i.owner_user_id IS NOT NULL) AS owned_at,
            (SELECT MIN(a.created_at) FROM response_actions a WHERE a.organization_id=s.organization_id AND a.signal_id=s.id) AS acted_at,
            (SELECT MIN(o.measured_at) FROM outcomes o WHERE o.organization_id=s.organization_id AND o.signal_id=s.id) AS measured_at,
            (SELECT MIN(o.measured_at) FROM outcomes o WHERE o.organization_id=s.organization_id AND o.signal_id=s.id AND o.measured_at + interval '30 days' <= $3 AND NOT EXISTS (SELECT 1 FROM signals r WHERE r.organization_id=s.organization_id AND r.id<>s.id AND r.category=s.category AND r.administrative_area_code=s.administrative_area_code AND r.observed_at>o.measured_at AND r.observed_at<=o.measured_at + interval '30 days')) AS durable_at
          FROM signals s WHERE s.organization_id=$1 AND s.observed_at >= $2 AND s.observed_at < $3
        )
        SELECT COUNT(*)::int AS signal, COUNT(*) FILTER (WHERE verified_at IS NOT NULL)::int AS verified, COUNT(*) FILTER (WHERE owned_at IS NOT NULL)::int AS owned, COUNT(*) FILTER (WHERE acted_at IS NOT NULL)::int AS acted, COUNT(*) FILTER (WHERE measured_at IS NOT NULL)::int AS measured, COUNT(*) FILTER (WHERE durable_at IS NOT NULL)::int AS durable, COUNT(*) FILTER (WHERE measured_at IS NOT NULL AND measured_at + interval '30 days' > $3)::int AS pending_durability FROM base`, [actor.organizationId, from.toISOString(), to.toISOString()]);
            const row = funnel.rows[0];
            if (!row)
                throw new Error('Outcome decay returned no summary row');
            const medians = await connection.query(`
        WITH base AS (
          SELECT s.id, s.category, s.administrative_area_code, s.created_at,
            (SELECT MIN(ae.occurred_at) FROM audit_events ae WHERE ae.organization_id=s.organization_id AND ae.resource_type='signal' AND ae.resource_id=s.id AND ae.action='signal.status_changed' AND ae.metadata->>'to'='verified' AND ae.occurred_at >= s.created_at) AS verified_at,
            (SELECT MIN(i.opened_at) FROM investigations i WHERE i.organization_id=s.organization_id AND i.signal_id=s.id AND i.owner_user_id IS NOT NULL) AS owned_at,
            (SELECT MIN(a.created_at) FROM response_actions a WHERE a.organization_id=s.organization_id AND a.signal_id=s.id) AS acted_at,
            (SELECT MIN(o.measured_at) FROM outcomes o WHERE o.organization_id=s.organization_id AND o.signal_id=s.id) AS measured_at,
            (SELECT MIN(o.measured_at) FROM outcomes o WHERE o.organization_id=s.organization_id AND o.signal_id=s.id AND o.measured_at + interval '30 days' <= $3 AND NOT EXISTS (SELECT 1 FROM signals r WHERE r.organization_id=s.organization_id AND r.id<>s.id AND r.category=s.category AND r.administrative_area_code=s.administrative_area_code AND r.observed_at>o.measured_at AND r.observed_at<=o.measured_at + interval '30 days')) AS durable_at
          FROM signals s WHERE s.organization_id=$1 AND s.observed_at >= $2 AND s.observed_at < $3
        ) SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (verified_at-created_at))/3600) FILTER (WHERE verified_at IS NOT NULL) AS verified,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (owned_at-created_at))/3600) FILTER (WHERE owned_at IS NOT NULL) AS owned,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (acted_at-created_at))/3600) FILTER (WHERE acted_at IS NOT NULL) AS acted,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (measured_at-created_at))/3600) FILTER (WHERE measured_at IS NOT NULL) AS measured,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (durable_at-created_at))/3600) FILTER (WHERE durable_at IS NOT NULL) AS durable FROM base`, [actor.organizationId, from.toISOString(), to.toISOString()]);
            const m = medians.rows[0] ?? { verified: null, owned: null, acted: null, measured: null, durable: null };
            const reasons = await connection.query(`SELECT rule_code AS code, COUNT(*)::int AS count FROM action_gap_detections WHERE organization_id=$1 AND status='open' GROUP BY rule_code ORDER BY count DESC, rule_code ASC`, [actor.organizationId]);
            const blockers = await connection.query(`SELECT blocker_type AS type, COUNT(*)::int AS count FROM response_actions WHERE organization_id=$1 AND blocker_type IS NOT NULL AND status='blocked' GROUP BY blocker_type ORDER BY count DESC, blocker_type ASC`, [actor.organizationId]);
            await connection.query('COMMIT');
            const signal = Number(row.signal), verified = Number(row.verified), owned = Number(row.owned), acted = Number(row.acted), measured = Number(row.measured), durable = Number(row.durable), pendingDurability = Number(row.pending_durability), denominator = Math.max(signal, 1);
            return { from: from.toISOString(), to: to.toISOString(), minCell, funnel: { signal, verified, owned, acted, measured, durable, pendingDurability }, completeness: { verified: Number((verified / denominator).toFixed(4)), owned: Number((owned / denominator).toFixed(4)), acted: Number((acted / denominator).toFixed(4)), measured: Number((measured / denominator).toFixed(4)), durable: Number((durable / denominator).toFixed(4)) }, medianHours: { verified: m.verified == null ? null : Number(m.verified), owned: m.owned == null ? null : Number(m.owned), acted: m.acted == null ? null : Number(m.acted), measured: m.measured == null ? null : Number(m.measured), durable: m.durable == null ? null : Number(m.durable) }, dropoutReasons: reasons.rows.map(r => ({ code: r.code, count: Number(r.count) })), blockers: blockers.rows.map(r => ({ type: r.type, count: Number(r.count) })), interpretation: 'Descriptive workflow diagnostic. Durable means the full configured 30-day observation window has elapsed after an outcome measurement and no comparable recurrence was observed; recently measured outcomes remain pending rather than being counted as durable. This is not proof of causal effectiveness.' };
        }
        catch (error) {
            try {
                await connection.query('ROLLBACK');
            }
            catch { }
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async sevenOneSeven(actor, from, to, minCell) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN READ ONLY');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const q = await connection.query(`
        WITH base AS (
          SELECT s.id, s.created_at,
            (SELECT MIN(ae.occurred_at) FROM audit_events ae WHERE ae.organization_id=s.organization_id AND ae.resource_type='signal' AND ae.resource_id=s.id AND ae.action='signal.notified') notified_at,
            (SELECT MIN(ae.occurred_at) FROM audit_events ae WHERE ae.organization_id=s.organization_id AND ae.resource_type='signal' AND ae.resource_id=s.id AND ae.action='signal.response_started') response_started_at,
            (SELECT MIN(o.measured_at) FROM outcomes o WHERE o.organization_id=s.organization_id AND o.signal_id=s.id) measured_at
          FROM signals s WHERE s.organization_id=$1 AND s.observed_at >= $2 AND s.observed_at < $3
        )
        SELECT COUNT(*)::int signal_count, COUNT(*) FILTER(WHERE notified_at IS NOT NULL)::int notified_count, COUNT(*) FILTER(WHERE response_started_at IS NOT NULL)::int response_started_count, COUNT(*) FILTER(WHERE measured_at IS NOT NULL)::int measured_outcome_count,
          percentile_cont(0.5) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(notified_at-created_at))/3600) FILTER(WHERE notified_at IS NOT NULL) dtn,
          percentile_cont(0.5) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(response_started_at-notified_at))/3600) FILTER(WHERE response_started_at IS NOT NULL AND notified_at IS NOT NULL) ntr,
          percentile_cont(0.5) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(response_started_at-created_at))/3600) FILTER(WHERE response_started_at IS NOT NULL) dtr,
          percentile_cont(0.5) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(measured_at-created_at))/3600) FILTER(WHERE measured_at IS NOT NULL) dtm
        FROM base`, [actor.organizationId, from.toISOString(), to.toISOString()]);
            const r = q.rows[0];
            if (!r)
                throw new Error('7-1-7 aggregate returned no row');
            await connection.query('COMMIT');
            return { from: from.toISOString(), to: to.toISOString(), signalCount: Number(r.signal_count), notifiedCount: Number(r.notified_count), responseStartedCount: Number(r.response_started_count), measuredOutcomeCount: Number(r.measured_outcome_count), medianHours: { detectionToNotification: r.dtn == null ? null : Number(r.dtn), notificationToResponse: r.ntr == null ? null : Number(r.ntr), detectionToResponse: r.dtr == null ? null : Number(r.dtr), detectionToMeasuredOutcome: r.dtm == null ? null : Number(r.dtm) }, interpretation: '7-1-7-aligned descriptive clocks. Detection is the signal observed timestamp; notification and response-start clocks exist only when explicitly recorded. The outcome clock is an additional PubliPulse completeness measure and does not establish causation or clinical effectiveness.' };
        }
        catch (error) {
            try {
                await connection.query('ROLLBACK');
            }
            catch { }
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async persistentProblemQueue(actor, minCell) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN READ ONLY');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const result = await connection.query(`
        SELECT p.id::text AS pattern_id, p.category, p.administrative_area_code, p.occurrence_count, p.unresolved_occurrences AS unresolved_count,
          COALESCE(a.recurrence_after_action_count,0) AS recurrence_after_action_count,
          COALESCE((SELECT COUNT(DISTINCT er.intervention_family) FROM expert_recommendations er WHERE er.organization_id=p.organization_id AND er.recurrence_pattern_id=p.id AND er.intervention_family IS NOT NULL),0)::int AS distinct_intervention_families,
          COALESCE(a.classification, CASE WHEN p.occurrence_count >= $2 AND p.unresolved_occurrences > 0 THEN 'persistent' ELSE 'emerging' END) AS classification,
          p.last_observed_at
        FROM recurrence_patterns p
        LEFT JOIN LATERAL (SELECT pa.recurrence_after_action_count, pa.classification FROM persistent_problem_assessments pa WHERE pa.organization_id=p.organization_id AND pa.recurrence_pattern_id=p.id ORDER BY pa.assessed_at DESC LIMIT 1) a ON true
        WHERE p.organization_id=$1 AND p.occurrence_count >= $2
          AND (p.unresolved_occurrences > 0 OR COALESCE(a.recurrence_after_action_count,0) > 0)
        ORDER BY CASE COALESCE(a.classification,'persistent') WHEN 'intervention_resistant' THEN 0 WHEN 'persistent' THEN 1 ELSE 2 END, p.last_observed_at DESC
        LIMIT 100`, [actor.organizationId, minCell]);
            await connection.query('COMMIT');
            return result.rows.map(r => ({ patternId: r.pattern_id, category: r.category, administrativeAreaCode: r.administrative_area_code, occurrenceCount: Number(r.occurrence_count), unresolvedCount: Number(r.unresolved_count), recurrenceAfterActionCount: Number(r.recurrence_after_action_count), distinctInterventionFamilies: Number(r.distinct_intervention_families), classification: r.classification, lastObservedAt: new Date(r.last_observed_at).toISOString() }));
        }
        catch (error) {
            try {
                await connection.query('ROLLBACK');
            }
            catch { }
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async weeklyReview(actor, weekStart, weekEnd, minCell) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN READ ONLY');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const result = await connection.query(`
        WITH base AS (
          SELECT s.id, s.administrative_area_code,
            EXISTS (SELECT 1 FROM audit_events ae WHERE ae.organization_id=s.organization_id AND ae.resource_type='signal' AND ae.resource_id=s.id AND ae.action='signal.status_changed' AND ae.metadata->>'to'='verified') AS verified,
            EXISTS (SELECT 1 FROM investigations i WHERE i.organization_id=s.organization_id AND i.signal_id=s.id AND i.owner_user_id IS NOT NULL) AS owned,
            EXISTS (SELECT 1 FROM response_actions a WHERE a.organization_id=s.organization_id AND a.signal_id=s.id) AS acted,
            EXISTS (SELECT 1 FROM outcomes o WHERE o.organization_id=s.organization_id AND o.signal_id=s.id) AS measured,
            EXISTS (SELECT 1 FROM outcomes o WHERE o.organization_id=s.organization_id AND o.signal_id=s.id AND o.measured_at + interval '30 days' <= $3 AND NOT EXISTS (SELECT 1 FROM signals r WHERE r.organization_id=s.organization_id AND r.id<>s.id AND r.category=s.category AND r.administrative_area_code=s.administrative_area_code AND r.observed_at>o.measured_at AND r.observed_at<=o.measured_at + interval '30 days')) AS durable,
            EXISTS (SELECT 1 FROM action_gap_detections g WHERE g.organization_id=s.organization_id AND g.signal_id=s.id AND g.status='open') AS unresolved,
            EXISTS (SELECT 1 FROM signals r WHERE r.organization_id=s.organization_id AND r.id<>s.id AND r.category=s.category AND r.administrative_area_code=s.administrative_area_code AND r.observed_at>s.observed_at AND r.observed_at<=s.observed_at + interval '30 days') AS recurrence,
            EXISTS (SELECT 1 FROM response_actions a WHERE a.organization_id=s.organization_id AND a.signal_id=s.id AND a.status='blocked' AND a.blocker_type IS NOT NULL) AS blocker
          FROM signals s WHERE s.organization_id=$1 AND s.observed_at >= $2 AND s.observed_at < $3
        )
        SELECT administrative_area_code, COUNT(*)::int signal_count, COUNT(*) FILTER(WHERE verified)::int verified_count, COUNT(*) FILTER(WHERE owned)::int owned_count,
          COUNT(*) FILTER(WHERE acted)::int acted_count, COUNT(*) FILTER(WHERE measured)::int measured_count, COUNT(*) FILTER(WHERE durable)::int durable_count,
          COUNT(*) FILTER(WHERE unresolved)::int unresolved_count, COUNT(*) FILTER(WHERE recurrence)::int recurrence_count, COUNT(*) FILTER(WHERE blocker)::int blocker_count
        FROM base GROUP BY administrative_area_code HAVING COUNT(*) >= $4 ORDER BY signal_count DESC, administrative_area_code ASC`, [actor.organizationId, weekStart.toISOString(), weekEnd.toISOString(), minCell]);
            await connection.query('COMMIT');
            return buildWeeklyReviewSummary(weekStart, weekEnd, minCell, result.rows.map(r => ({
                administrativeAreaCode: r.administrative_area_code, signalCount: Number(r.signal_count), verifiedCount: Number(r.verified_count), ownedCount: Number(r.owned_count),
                actedCount: Number(r.acted_count), measuredCount: Number(r.measured_count), durableCount: Number(r.durable_count), unresolvedCount: Number(r.unresolved_count),
                recurrenceCount: Number(r.recurrence_count), blockerCount: Number(r.blocker_count)
            })));
        }
        catch (error) {
            try {
                await connection.query('ROLLBACK');
            }
            catch { }
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async recordPilotEvidence(actor, input) {
        const baselineStart = new Date(input.baselineStart), baselineEnd = new Date(input.baselineEnd);
        const pilotStart = new Date(input.pilotStart), pilotEnd = new Date(input.pilotEnd);
        const baseline = await this.outcomeDecay(actor, baselineStart, baselineEnd, input.minCell);
        const pilot = await this.outcomeDecay(actor, pilotStart, pilotEnd, input.minCell);
        const rate = (n, d) => d > 0 ? Number((n / d).toFixed(4)) : null;
        const delta = (a, b) => a !== null && b !== null ? Number((b - a).toFixed(4)) : null;
        const metric = (b, p, bd, pd) => ({ baseline: rate(b, bd), pilot: rate(p, pd), delta: delta(rate(b, bd), rate(p, pd)) });
        const unresolved = (x) => x.dropoutReasons.reduce((n, r) => n + r.count, 0);
        const blockers = (x) => x.blockers.reduce((n, r) => n + r.count, 0);
        const snapshot = {
            windows: { baseline: { start: baselineStart.toISOString(), end: baselineEnd.toISOString() }, pilot: { start: pilotStart.toISOString(), end: pilotEnd.toISOString() } },
            metrics: {
                verificationCompleteness: metric(baseline.funnel.verified, pilot.funnel.verified, baseline.funnel.signal, pilot.funnel.signal),
                ownershipCompleteness: metric(baseline.funnel.owned, pilot.funnel.owned, baseline.funnel.signal, pilot.funnel.signal),
                actionCompleteness: metric(baseline.funnel.acted, pilot.funnel.acted, baseline.funnel.signal, pilot.funnel.signal),
                outcomeMeasurementCompleteness: metric(baseline.funnel.measured, pilot.funnel.measured, baseline.funnel.signal, pilot.funnel.signal),
                durableOutcomeCompleteness: metric(baseline.funnel.durable, pilot.funnel.durable, baseline.funnel.signal, pilot.funnel.signal),
                unresolvedBurden: { baseline: unresolved(baseline), pilot: unresolved(pilot), delta: unresolved(pilot) - unresolved(baseline) },
                pendingDurability: { baseline: baseline.funnel.pendingDurability, pilot: pilot.funnel.pendingDurability, delta: pilot.funnel.pendingDurability - baseline.funnel.pendingDurability },
                blockerCount: { baseline: blockers(baseline), pilot: blockers(pilot), delta: blockers(pilot) - blockers(baseline) }
            },
            operationalEvidence: {
                weeklyDecisionChangeCount: input.weeklyDecisionChangeCount,
                offlineSyncIncidentCount: input.offlineSyncIncidentCount,
                integrationIncidentCount: input.integrationIncidentCount,
                privacyIncidentCount: input.privacyIncidentCount,
                securityIncidentCount: input.securityIncidentCount
            },
            interpretation: 'Descriptive pilot evidence only. It records observed workflow differences and implementation events; it does not establish causation, clinical effectiveness, outbreak control, or superiority.'
        };
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const inserted = await connection.query(`INSERT INTO pilot_evidence_records
        (organization_id,label,baseline_start,baseline_end,pilot_start,pilot_end,minimum_cell,comparison_snapshot,weekly_decision_change_count,offline_sync_incident_count,integration_incident_count,privacy_incident_count,security_incident_count,evidence_digest,recorded_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15) RETURNING id, recorded_at`, [actor.organizationId, input.label, baselineStart.toISOString(), baselineEnd.toISOString(), pilotStart.toISOString(), pilotEnd.toISOString(), input.minCell, JSON.stringify(snapshot), input.weeklyDecisionChangeCount, input.offlineSyncIncidentCount, input.integrationIncidentCount, input.privacyIncidentCount, input.securityIncidentCount, input.evidenceDigest ?? null, actor.userId]);
            const row = inserted.rows[0];
            if (!row)
                throw new Error('pilot_evidence_insert_failed');
            await connection.query(`INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES ($1,$2,'pilot.evidence_recorded','pilot_evidence_record',$3,'success',$4::jsonb)`, [actor.organizationId, actor.userId, row.id, JSON.stringify({ label: input.label, minCell: input.minCell })]);
            await connection.query('COMMIT');
            return { id: row.id, recordedAt: new Date(row.recorded_at).toISOString(), comparisonSnapshot: snapshot };
        }
        catch (error) {
            try {
                await connection.query('ROLLBACK');
            }
            catch { }
            ;
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async recordWeeklyDecision(actor, input) {
        const connection = await this.pool.connect();
        try {
            await connection.query('BEGIN');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const inserted = await connection.query(`INSERT INTO weekly_review_decisions
        (organization_id,week_start,week_end,administrative_area_code,agenda_code,decision,rationale,next_check_at,owner_role,evidence_digest,decided_by,client_mutation_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, decided_at AS recorded_at`, [actor.organizationId, input.weekStart, input.weekEnd, input.administrativeAreaCode, input.agendaCode, input.decision, input.rationale, input.nextCheckAt, input.ownerRole, input.evidenceDigest ?? null, actor.userId, input.clientMutationId]);
            const row = inserted.rows[0];
            if (!row)
                throw new Error('weekly_decision_insert_failed');
            await connection.query(`INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES ($1,$2,'weekly.review_decision_recorded','weekly_review_decision',$3,'success',$4::jsonb)`, [actor.organizationId, actor.userId, row.id, JSON.stringify({ agendaCode: input.agendaCode, decision: input.decision, administrativeAreaCode: input.administrativeAreaCode })]);
            await connection.query('COMMIT');
            return { id: row.id, recordedAt: new Date(row.recorded_at).toISOString() };
        }
        catch (error) {
            try {
                await connection.query('ROLLBACK');
            }
            catch { }
            throw error;
        }
        finally {
            connection.release();
        }
    }
}
