import { PilotEvidenceRecordInputSchema } from '@publipulse/shared/pilot-evidence';
import { canReadOperationalLearning, canRecordWeeklyDecision } from './learning-store.js';
import { WeeklyDecisionInputSchema } from '@publipulse/shared/weekly-decision';
function parseStrictPositiveInt(value, fallback, max) {
    if (value === undefined)
        return fallback;
    if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value))
        return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}
export async function registerLearningRoutes(app, opts) {
    app.get('/v1/learning/persistent-problems', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadOperationalLearning(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const query = req.query;
        const minCell = parseStrictPositiveInt(query.minCell, 5, 1000);
        if (minCell === null)
            return reply.code(400).send({ error: 'invalid_min_cell', requestId: req.id });
        const queue = await opts.store.persistentProblemQueue(actor, minCell);
        return reply.send({ scope: 'authenticated_organization', privacy: { minimumOccurrenceCell: minCell, individualRecordsExcluded: true }, interpretation: 'Prioritization queue only. Intervention-resistant means recurrence after multiple intervention families; it is not proof of intervention failure or causation.', queue });
    });
    app.get('/v1/learning/7-1-7', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadOperationalLearning(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const query = req.query;
        const days = parseStrictPositiveInt(query.days, 90, 3650);
        const minCell = parseStrictPositiveInt(query.minCell, 5, 1000);
        if (days === null || minCell === null)
            return reply.code(400).send({ error: 'invalid_7_1_7_parameters', requestId: req.id });
        const to = new Date();
        const from = new Date(to.getTime() - days * 86400000);
        const summary = await opts.store.sevenOneSeven(actor, from, to, minCell);
        return reply.send({ scope: 'authenticated_organization', privacy: { minimumSignalCell: minCell, individualRecordsExcluded: true }, summary });
    });
    app.get('/v1/learning/outcome-decay', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadOperationalLearning(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const query = req.query;
        const days = parseStrictPositiveInt(query.days, 90, 3650);
        const minCell = parseStrictPositiveInt(query.minCell, 5, 1000);
        if (days === null || minCell === null)
            return reply.code(400).send({ error: 'invalid_decay_parameters', requestId: req.id });
        const to = new Date();
        const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
        const summary = await opts.store.outcomeDecay(actor, from, to, minCell);
        return reply.send({ scope: 'authenticated_organization', privacy: { minimumSignalCell: minCell, suppressedSmallCells: true, individualRecordsExcluded: true }, summary });
    });
    app.get('/v1/learning/weekly-review', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadOperationalLearning(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const query = req.query;
        const minCell = parseStrictPositiveInt(query.minCell, 5, 1000);
        if (minCell === null)
            return reply.code(400).send({ error: 'invalid_weekly_review_parameters', requestId: req.id });
        const weekEnd = query.weekEnd ? new Date(query.weekEnd) : new Date();
        const weekStart = query.weekStart ? new Date(query.weekStart) : new Date(weekEnd.getTime() - 7 * 86400000);
        if (!Number.isFinite(weekStart.getTime()) || !Number.isFinite(weekEnd.getTime()) || weekStart >= weekEnd || weekEnd.getTime() - weekStart.getTime() > 31 * 86400000)
            return reply.code(400).send({ error: 'invalid_weekly_review_window', requestId: req.id });
        const summary = await opts.store.weeklyReview(actor, weekStart, weekEnd, minCell);
        return reply.send({ scope: 'authenticated_organization', privacy: { minimumSignalCell: minCell, suppressedSmallCells: true, individualRecordsExcluded: true }, summary });
    });
    app.get('/v1/learning/pilot-comparison', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadOperationalLearning(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const query = req.query;
        const minCell = parseStrictPositiveInt(query.minCell, 5, 1000);
        const baselineStart = query.baselineStart ? new Date(query.baselineStart) : null;
        const baselineEnd = query.baselineEnd ? new Date(query.baselineEnd) : null;
        const pilotStart = query.pilotStart ? new Date(query.pilotStart) : null;
        const pilotEnd = query.pilotEnd ? new Date(query.pilotEnd) : null;
        if (minCell === null || !baselineStart || !baselineEnd || !pilotStart || !pilotEnd ||
            !Number.isFinite(baselineStart.getTime()) || !Number.isFinite(baselineEnd.getTime()) ||
            !Number.isFinite(pilotStart.getTime()) || !Number.isFinite(pilotEnd.getTime()) ||
            baselineStart >= baselineEnd || pilotStart >= pilotEnd ||
            baselineEnd.getTime() - baselineStart.getTime() > 366 * 86400000 ||
            pilotEnd.getTime() - pilotStart.getTime() > 366 * 86400000) {
            return reply.code(400).send({ error: 'invalid_pilot_comparison_window', requestId: req.id });
        }
        const [baseline, pilot] = await Promise.all([
            opts.store.outcomeDecay(actor, baselineStart, baselineEnd, minCell),
            opts.store.outcomeDecay(actor, pilotStart, pilotEnd, minCell)
        ]);
        const rate = (n, d) => d > 0 ? Number((n / d).toFixed(4)) : null;
        const delta = (a, b) => a !== null && b !== null ? Number((b - a).toFixed(4)) : null;
        const metric = (b, p, bd, pd) => ({ baseline: rate(b, bd), pilot: rate(p, pd), delta: delta(rate(b, bd), rate(p, pd)) });
        const baselineDenominator = baseline.funnel.signal;
        const pilotDenominator = pilot.funnel.signal;
        return reply.send({
            scope: 'authenticated_organization',
            privacy: { minimumSignalCell: minCell, suppressedSmallCells: true, individualRecordsExcluded: true },
            windows: { baseline: { start: baselineStart.toISOString(), end: baselineEnd.toISOString() }, pilot: { start: pilotStart.toISOString(), end: pilotEnd.toISOString() } },
            metrics: {
                verificationCompleteness: metric(baseline.funnel.verified, pilot.funnel.verified, baselineDenominator, pilotDenominator),
                ownershipCompleteness: metric(baseline.funnel.owned, pilot.funnel.owned, baselineDenominator, pilotDenominator),
                actionCompleteness: metric(baseline.funnel.acted, pilot.funnel.acted, baselineDenominator, pilotDenominator),
                outcomeMeasurementCompleteness: metric(baseline.funnel.measured, pilot.funnel.measured, baselineDenominator, pilotDenominator),
                durableOutcomeCompleteness: metric(baseline.funnel.durable, pilot.funnel.durable, baselineDenominator, pilotDenominator),
                unresolvedBurden: { baseline: baseline.dropoutReasons.reduce((n, r) => n + r.count, 0), pilot: pilot.dropoutReasons.reduce((n, r) => n + r.count, 0), delta: pilot.dropoutReasons.reduce((n, r) => n + r.count, 0) - baseline.dropoutReasons.reduce((n, r) => n + r.count, 0) },
                pendingDurability: { baseline: baseline.funnel.pendingDurability, pilot: pilot.funnel.pendingDurability, delta: pilot.funnel.pendingDurability - baseline.funnel.pendingDurability },
                blockerCount: { baseline: baseline.blockers.reduce((n, r) => n + r.count, 0), pilot: pilot.blockers.reduce((n, r) => n + r.count, 0), delta: pilot.blockers.reduce((n, r) => n + r.count, 0) - baseline.blockers.reduce((n, r) => n + r.count, 0) }
            },
            interpretation: 'Descriptive implementation comparison only. Baseline and pilot periods must use documented compatible definitions and cohort boundaries. Differences do not establish causation, clinical effectiveness, or superiority.'
        });
    });
    app.post('/v1/learning/pilot-evidence', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadOperationalLearning(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const parsed = PilotEvidenceRecordInputSchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_pilot_evidence_record', requestId: req.id, issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code })) });
        try {
            const record = await opts.store.recordPilotEvidence(actor, parsed.data);
            return reply.code(201).send({ record, disclaimer: 'This is an immutable descriptive pilot evidence snapshot. It does not establish causation, clinical effectiveness, outbreak control, or superiority.' });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('duplicate key'))
                return reply.code(409).send({ error: 'pilot_evidence_already_recorded', requestId: req.id });
            throw error;
        }
    });
    app.post('/v1/learning/weekly-decision', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canRecordWeeklyDecision(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const parsed = WeeklyDecisionInputSchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'invalid_weekly_decision', requestId: req.id, issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code })) });
        try {
            const record = await opts.store.recordWeeklyDecision(actor, parsed.data);
            return reply.code(201).send({ record, interpretation: 'This is an append-only operational learning decision. It records a human decision and follow-up checkpoint; it does not establish causation, clinical effectiveness, or programme superiority.' });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('duplicate key'))
                return reply.code(409).send({ error: 'weekly_decision_already_recorded', requestId: req.id });
            throw error;
        }
    });
    app.get('/v1/learning/operational-patterns', async (req, reply) => {
        const actor = await opts.resolveActor(req.headers.authorization, typeof req.headers['x-organization-id'] === 'string' ? req.headers['x-organization-id'] : undefined);
        if (!actor)
            return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
        if (!canReadOperationalLearning(actor))
            return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
        const query = req.query;
        const days = parseStrictPositiveInt(query.days, 90, 3650);
        const minCell = parseStrictPositiveInt(query.minCell, 5, 1000);
        if (days === null || minCell === null) {
            return reply.code(400).send({ error: 'invalid_learning_parameters', requestId: req.id });
        }
        const to = new Date();
        const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
        const summary = await opts.store.operationalPatterns(actor, from, to, minCell);
        return reply.send({
            scope: 'authenticated_organization',
            privacy: { minimumSignalCell: minCell, suppressedSmallCells: true, individualRecordsExcluded: true },
            interpretation: 'Descriptive operational learning only. Aggregates do not establish outbreak status, clinical risk, causation, or programme effectiveness.',
            summary
        });
    });
}
