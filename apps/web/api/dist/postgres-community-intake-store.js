import { COMMUNITY_CATEGORIES } from '@publipulse/shared';
const HOUR = 3_600_000;
const iso = (v) => new Date(v).toISOString();
const SIGNAL_CATEGORY = {
    unusual_illness: 'unusual_illness', water_sanitation: 'environmental_hazard', supply_gap: 'service_disruption', animal_health: 'other', other: 'other'
};
/** Plain summary from the structured fields. The note, if any, already passed the direct-identifier check at intake. */
export function defaultSummary(s) {
    const label = COMMUNITY_CATEGORIES.find((c) => c.key === s.category)?.label ?? 'Other';
    return `Community report by ${s.channel.toUpperCase()}: ${label}.${s.urgent ? ' The reporter said several people are sick.' : ''}${s.narrative ? ` Note from reporter: ${s.narrative}` : ''}`;
}
export class PostgresCommunityIntakeStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async tx(organizationId, readOnly, fn) {
        const c = await this.pool.connect();
        try {
            await c.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
            await c.query("SELECT set_config('app.organization_id',$1,true)", [organizationId]);
            const out = await fn(c);
            await c.query('COMMIT');
            return out;
        }
        catch (e) {
            try {
                await c.query('ROLLBACK');
            }
            catch { /* keep the original failure */ }
            throw e;
        }
        finally {
            c.release();
        }
    }
    /** Serialises work for one sender (or one submission) so two simultaneous messages cannot both slip under a limit. */
    lock(c, key) { return c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]); }
    async inCooldown(c, organizationId, senderHash, now, limits) {
        const r = await c.query(`SELECT occurred_at FROM community_sender_events WHERE organization_id=$1 AND sender_hash=$2 AND kind='rejected' AND occurred_at > $3::timestamptz - make_interval(hours => $4::int) ORDER BY occurred_at DESC LIMIT $5`, [organizationId, senderHash, now.toISOString(), limits.cooldownHours, limits.cooldownRejects]);
        if (r.rows.length < limits.cooldownRejects)
            return false;
        const newest = new Date(r.rows[0].occurred_at).getTime();
        const oldest = new Date(r.rows[r.rows.length - 1].occurred_at).getTime();
        return newest - oldest <= HOUR;
    }
    async receive(organizationId, input, now, limits) {
        const { senderHash, duplicateHash, submission: s } = input;
        return this.tx(organizationId, false, async (c) => {
            await this.lock(c, `${organizationId}:${senderHash}`);
            if (await this.inCooldown(c, organizationId, senderHash, now, limits))
                return { kind: 'limited', reason: 'cooldown' };
            const org = await c.query("SELECT count(*)::int AS n FROM community_sender_events WHERE organization_id=$1 AND kind IN ('accepted','rejected') AND occurred_at > $2::timestamptz - interval '1 hour'", [organizationId, now.toISOString()]);
            if ((org.rows[0]?.n ?? 0) >= limits.organizationPerHour) {
                const marker = await c.query("SELECT id::text AS id FROM community_sender_events WHERE organization_id=$1 AND kind='marker' AND occurred_at > $2::timestamptz - interval '1 hour' LIMIT 1", [organizationId, now.toISOString()]);
                if (!marker.rows[0]) {
                    await c.query("INSERT INTO community_sender_events (organization_id,sender_hash,kind,occurred_at) VALUES($1,$2,'marker',$3)", [organizationId, senderHash, now.toISOString()]);
                    await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,NULL,'community_intake.organization_cap_reached','community_intake',NULL,'denied',$2::jsonb)", [organizationId, JSON.stringify({ perHour: limits.organizationPerHour })]);
                }
                return { kind: 'limited', reason: 'organization_cap' };
            }
            const dup = await c.query("SELECT id::text AS id FROM community_sender_events WHERE organization_id=$1 AND sender_hash=$2 AND kind='accepted' AND duplicate_hash=$3 AND occurred_at > $4::timestamptz - interval '24 hours' LIMIT 1", [organizationId, senderHash, duplicateHash, now.toISOString()]);
            if (dup.rows[0])
                return { kind: 'duplicate' };
            const counts = await c.query(`SELECT (count(*) FILTER (WHERE occurred_at > $3::timestamptz - interval '1 hour'))::int AS h, count(*)::int AS d FROM community_sender_events
         WHERE organization_id=$1 AND sender_hash=$2 AND kind='accepted' AND occurred_at > $3::timestamptz - interval '24 hours'`, [organizationId, senderHash, now.toISOString()]);
            const h = counts.rows[0]?.h ?? 0;
            const d = counts.rows[0]?.d ?? 0;
            if (h >= limits.senderPerHour || d >= limits.senderPerDay) {
                await c.query("INSERT INTO community_sender_events (organization_id,sender_hash,kind,occurred_at) VALUES($1,$2,'rejected',$3)", [organizationId, senderHash, now.toISOString()]);
                return { kind: 'limited', reason: h >= limits.senderPerHour ? 'sender_hourly' : 'sender_daily' };
            }
            const row = await c.query('INSERT INTO community_intake_submissions (organization_id,channel,category,area_code,narrative,urgent,consent_version,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [organizationId, s.channel, s.category, s.areaCode, s.narrative, s.urgent, s.consentVersion, now.toISOString()]);
            const id = row.rows[0]?.id;
            if (!id)
                throw new Error('Submission insert returned no row');
            // The event row carries only the keyed hashes; nothing in it points at the submission.
            await c.query("INSERT INTO community_sender_events (organization_id,sender_hash,kind,duplicate_hash,occurred_at) VALUES($1,$2,'accepted',$3,$4)", [organizationId, senderHash, duplicateHash, now.toISOString()]);
            await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,NULL,'community_intake.received','community_intake_submission',$2,'success',$3::jsonb)", [organizationId, id, JSON.stringify({ channel: s.channel, category: s.category, urgent: s.urgent })]);
            return { kind: 'accepted', id };
        });
    }
    async reject(organizationId, senderHash, now, limits) {
        await this.tx(organizationId, false, async (c) => {
            await this.lock(c, `${organizationId}:${senderHash}`);
            if (await this.inCooldown(c, organizationId, senderHash, now, limits))
                return;
            await c.query("INSERT INTO community_sender_events (organization_id,sender_hash,kind,occurred_at) VALUES($1,$2,'rejected',$3)", [organizationId, senderHash, now.toISOString()]);
        });
    }
    async listQueue(actor, status, limit) {
        const filter = status === 'pending' ? 'AND r.id IS NULL' : status === 'reviewed' ? 'AND r.id IS NOT NULL' : '';
        return this.tx(actor.organizationId, true, async (c) => {
            const r = await c.query(`SELECT s.id, s.channel, s.category, s.area_code, s.narrative, s.urgent, s.received_at, r.decision, r.decided_at, r.signal_id
         FROM community_intake_submissions s LEFT JOIN community_intake_reviews r ON r.organization_id=s.organization_id AND r.submission_id=s.id
         WHERE s.organization_id=$1 ${filter} ORDER BY (r.id IS NOT NULL), s.urgent DESC, s.received_at ASC LIMIT $2`, [actor.organizationId, limit]);
            return r.rows.map((x) => ({ id: x.id, channel: x.channel, category: x.category, areaCode: x.area_code, narrative: x.narrative, urgent: x.urgent, receivedAt: iso(x.received_at), decision: x.decision, decidedAt: x.decided_at ? iso(x.decided_at) : null, signalId: x.signal_id }));
        });
    }
    async queueStats(actor, now) {
        return this.tx(actor.organizationId, true, async (c) => {
            const r = await c.query(`SELECT (count(*) FILTER (WHERE r.id IS NULL))::int AS pending,
                (count(*) FILTER (WHERE r.id IS NULL AND s.urgent))::int AS urgent_pending,
                min(s.received_at) FILTER (WHERE r.id IS NULL) AS oldest,
                (count(*) FILTER (WHERE r.decided_at > $2::timestamptz - interval '30 days'))::int AS reviewed30,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (r.decided_at - s.received_at))/3600) FILTER (WHERE r.decided_at > $2::timestamptz - interval '30 days') AS median_hours
         FROM community_intake_submissions s LEFT JOIN community_intake_reviews r ON r.organization_id=s.organization_id AND r.submission_id=s.id
         WHERE s.organization_id=$1`, [actor.organizationId, now.toISOString()]);
            const row = r.rows[0];
            const oldest = row?.oldest ? iso(row.oldest) : null;
            return {
                pending: row?.pending ?? 0, urgentPending: row?.urgent_pending ?? 0, oldestPendingAt: oldest,
                oldestPendingHours: oldest ? Math.round(((now.getTime() - Date.parse(oldest)) / HOUR) * 10) / 10 : null,
                reviewedLast30Days: row?.reviewed30 ?? 0, medianHoursToReview: row?.median_hours == null ? null : Math.round(Number(row.median_hours) * 10) / 10
            };
        });
    }
    async review(actor, submissionId, decision, now) {
        try {
            return await this.tx(actor.organizationId, false, async (c) => {
                // Row locks are not available to the runtime role on append-only tables, so serialise on the submission id instead.
                await this.lock(c, `review:${actor.organizationId}:${submissionId}`);
                const sub = await c.query('SELECT channel, category, area_code, narrative, urgent, received_at FROM community_intake_submissions WHERE organization_id=$1 AND id=$2', [actor.organizationId, submissionId]);
                const s = sub.rows[0];
                if (!s)
                    return { kind: 'not_found' };
                const done = await c.query('SELECT id FROM community_intake_reviews WHERE organization_id=$1 AND submission_id=$2', [actor.organizationId, submissionId]);
                if (done.rows[0])
                    return { kind: 'already_reviewed' };
                let signalId = null;
                let stored;
                let reason = null;
                if (decision.decision === 'promote') {
                    stored = 'promoted';
                    const category = decision.category ?? SIGNAL_CATEGORY[s.category] ?? 'other';
                    const summary = decision.summary ?? defaultSummary({ channel: s.channel, category: s.category, urgent: s.urgent, narrative: s.narrative });
                    // Same insert as PostgresSignalStore.createIdempotent, done here so the signal and the decision commit together.
                    const sig = await c.query(`INSERT INTO signals (organization_id, submitted_by, client_submission_id, category, summary, source_type, observed_at, administrative_area_code, location_precision)
             VALUES ($1,$2,$3,$4,$5,'community_report',$6,$7,$8) RETURNING id`, [actor.organizationId, actor.userId, submissionId, category, summary, new Date(s.received_at).toISOString(), s.area_code, decision.precision ?? 'community']);
                    signalId = sig.rows[0]?.id ?? null;
                    if (!signalId)
                        throw new Error('Signal insert returned no row');
                    await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'signal.created','signal',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, signalId, JSON.stringify({ sourceType: 'community_report', category })]);
                }
                else if (decision.decision === 'merge') {
                    stored = 'merged';
                    signalId = decision.signalId;
                    reason = decision.reason ?? 'Same event as an existing signal';
                }
                else {
                    stored = 'dismissed';
                    reason = decision.reason;
                }
                await c.query('INSERT INTO community_intake_reviews (organization_id,submission_id,decision,reason,signal_id,decided_by,decided_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [actor.organizationId, submissionId, stored, reason, signalId, actor.userId, now.toISOString()]);
                await c.query("INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'community_intake.reviewed','community_intake_submission',$3,'success',$4::jsonb)", [actor.organizationId, actor.userId, submissionId, JSON.stringify({ decision: stored })]);
                return { kind: 'reviewed', decision: stored, signalId };
            });
        }
        catch (e) {
            // A merge names a signal that does not exist in this organisation (composite foreign key).
            if (e.code === '23503')
                return { kind: 'signal_not_found' };
            throw e;
        }
    }
}
