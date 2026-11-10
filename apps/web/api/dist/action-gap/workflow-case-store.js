const iso = (value) => value == null ? null : new Date(value).toISOString();
/** Loads bounded, organization-scoped workflow snapshots from persisted records. */
export class PostgresWorkflowCaseStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async listForEvaluation(actor, limit) {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN READ ONLY');
            await c.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
            const q = await c.query(`
        SELECT s.id::text AS id, s.id::text AS signal_id, s.organization_id::text AS organization_id,
          s.created_at, s.status::text AS signal_status, s.category, s.source_type, s.administrative_area_code,
          (SELECT GREATEST(COUNT(*) - 1, 0)::int FROM signals prior WHERE prior.organization_id=s.organization_id AND prior.category=s.category AND prior.administrative_area_code=s.administrative_area_code AND prior.observed_at >= s.observed_at - interval '30 days' AND prior.observed_at <= s.observed_at) AS recurrences,
          CASE WHEN s.status::text IN ('verified','closed','dismissed') THEN s.updated_at ELSE NULL END AS verified_at,
          i.id::text AS investigation_id, i.owner_user_id::text AS investigation_owner,
          i.status::text AS investigation_status, i.opened_at AS investigation_opened_at,
          a.id::text AS action_id, a.owner_user_id::text AS action_owner, a.status::text AS action_status,
          a.due_at, a.created_at AS action_created_at, CASE WHEN a.status::text='blocked' THEN COALESCE(a.description, a.title) ELSE NULL END AS blocker, a.blocker_type,
          d.id::text AS decision_id, d.created_at AS decision_created_at,
          (a.completion_evidence IS NOT NULL AND length(trim(a.completion_evidence)) > 0) AS has_completion_evidence,
          h.initiated_at AS handoff_at, h.accepted_at AS handoff_accepted_at,
          EXISTS(SELECT 1 FROM evidence e WHERE e.organization_id=s.organization_id AND e.signal_id=s.id) AS has_evidence,
          EXISTS(SELECT 1 FROM outcomes o WHERE o.organization_id=s.organization_id AND o.signal_id=s.id) AS has_outcome,
          EXISTS(SELECT 1 FROM reporter_feedback_events f WHERE f.organization_id=s.organization_id AND f.signal_id=s.id) AS feedback_recorded
        FROM signals s
        LEFT JOIN LATERAL (SELECT * FROM investigations x WHERE x.organization_id=s.organization_id AND x.signal_id=s.id ORDER BY x.opened_at DESC LIMIT 1) i ON true
        LEFT JOIN LATERAL (SELECT * FROM response_actions x WHERE x.organization_id=s.organization_id AND x.signal_id=s.id ORDER BY x.created_at DESC LIMIT 1) a ON true
        LEFT JOIN LATERAL (SELECT * FROM decisions x WHERE x.organization_id=s.organization_id AND x.signal_id=s.id ORDER BY x.created_at DESC LIMIT 1) d ON true
        LEFT JOIN LATERAL (
          SELECT init.occurred_at AS initiated_at,
            (SELECT accepted.occurred_at FROM action_handoff_events accepted
              WHERE accepted.organization_id=init.organization_id AND accepted.action_id=init.action_id
                AND accepted.event_type='accepted' AND accepted.occurred_at >= init.occurred_at
              ORDER BY accepted.occurred_at ASC, accepted.id ASC LIMIT 1) AS accepted_at
          FROM action_handoff_events init
          WHERE init.organization_id=s.organization_id AND init.action_id=a.id AND init.event_type='initiated'
          ORDER BY init.occurred_at DESC, init.id DESC LIMIT 1
        ) h ON true
        WHERE s.organization_id=$1
        ORDER BY s.updated_at ASC, s.id ASC LIMIT $2`, [actor.organizationId, limit]);
            await c.query('COMMIT');
            return q.rows.map(r => {
                const stage = r.action_id ? 'response' : r.decision_id ? 'decision' : r.investigation_id ? 'investigation' : 'signal';
                const status = r.action_status ?? (r.decision_id ? 'decision_pending_action' : null) ?? r.investigation_status ?? r.signal_status;
                return {
                    id: r.action_id ?? r.investigation_id ?? r.id, signalId: r.signal_id, organizationId: r.organization_id,
                    stage, createdAt: iso(r.action_created_at ?? r.investigation_opened_at ?? r.created_at), status,
                    verifiedAt: iso(r.verified_at), owner: r.action_owner ?? r.investigation_owner,
                    dueAt: iso(r.due_at), outcomeEvidence: r.has_outcome || r.has_completion_evidence,
                    recurrences: Number(r.recurrences ?? 0), blocker: r.blocker, blockerType: r.blocker_type, feedbackRecorded: r.feedback_recorded, sourceType: r.source_type,
                    handoffAt: iso(r.handoff_at), handoffAcceptedAt: iso(r.handoff_accepted_at), handoffSlaDays: 2,
                    ...(!r.has_evidence ? { evidenceQuality: 'limited' } : {})
                };
            });
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
