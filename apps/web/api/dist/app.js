import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { registerSignalRoutes } from './signal-routes.js';
import { registerEvidenceRoutes } from './evidence-routes.js';
import { registerInvestigationRoutes } from './investigation-routes.js';
import { registerDecisionActionRoutes } from './decision-action-routes.js';
import { registerAuditRoutes } from './audit-routes.js';
import { registerOutcomeRoutes } from './outcome-routes.js';
import { registerActionCostRoutes } from './action-cost-routes.js';
import { registerCommunityIntakeRoutes } from './community-intake-routes.js';
import { registerMembershipRoutes } from './membership-routes.js';
import { registerStockRoutes } from './stock-routes.js';
import { registerContextRoutes } from './context-routes.js';
import { registerActionGapRoutes } from './action-gap-routes.js';
import { registerActionHandoffRoutes } from './action-handoff-routes.js';
import { registerLearningRoutes } from './learning-routes.js';
import { registerInteroperabilityRoutes } from './interoperability-routes.js';
import { registerReporterFeedbackRoutes } from './reporter-feedback-routes.js';
import { registerUpstreamEventRoutes } from './upstream-event-routes.js';
import { parseWebOrigins } from './server-config.js';
export async function buildApp(options = {}) {
    const isProduction = (options.environment ?? process.env.NODE_ENV) === 'production';
    const configuredOrigin = options.allowedOrigin ?? process.env.WEB_ORIGIN;
    if (isProduction && !configuredOrigin)
        throw new Error('WEB_ORIGIN must be explicitly configured in production');
    // WEB_ORIGIN may list several exact origins, comma-separated (for example web command center + field PWA).
    const allowedOrigins = new Set(parseWebOrigins(configuredOrigin ?? 'http://localhost:5173', isProduction));
    const app = Fastify({
        logger: {
            level: isProduction ? 'info' : 'debug',
            redact: {
                paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.email', '*.phone'],
                censor: '[REDACTED]'
            },
            // Fastify's serializer type requires type/message/stack; message and stack are
            // deliberately redacted so error text (which can embed request data) never reaches logs.
            serializers: {
                err: (error) => ({
                    type: error.name,
                    name: error.name,
                    message: '[REDACTED]',
                    stack: '[REDACTED]',
                    ...(typeof error.code === 'string'
                        ? { code: error.code }
                        : {})
                })
            }
        },
        bodyLimit: 1_048_576,
        requestTimeout: 15_000,
        trustProxy: false
    });
    await app.register(helmet, { contentSecurityPolicy: false });
    if (isProduction) {
        app.addHook('onRequest', async (_request, reply) => {
            reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        });
    }
    await app.register(sensible);
    await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
    app.addHook('onRequest', async (request, reply) => {
        reply.header('X-Request-Id', request.id);
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('Cache-Control', 'no-store');
        reply.header('Referrer-Policy', 'no-referrer');
        reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        const origin = request.headers.origin;
        if (origin && !allowedOrigins.has(origin)) {
            return reply.code(403).send({ error: 'origin_not_allowed', requestId: request.id });
        }
        if (origin) {
            reply.header('Access-Control-Allow-Origin', origin);
            reply.header('Vary', 'Origin');
            reply.header('Access-Control-Allow-Headers', 'content-type, authorization, idempotency-key, x-organization-id, x-client-mutation-id');
            reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        }
        if (request.method === 'OPTIONS')
            return reply.code(204).send();
    });
    app.get('/health/live', async () => ({ status: 'ok' }));
    if (options.resolveActor && options.auditStore) {
        await registerAuditRoutes(app, { resolveActor: options.resolveActor, store: options.auditStore });
    }
    else {
        app.get('/v1/audit-events', async (_request, reply) => reply.code(503).send({ error: 'audit_service_not_configured' }));
    }
    if (options.resolveActor && options.signalStore) {
        await registerSignalRoutes(app, { resolveActor: options.resolveActor, store: options.signalStore });
        if (options.evidenceStore) {
            await registerEvidenceRoutes(app, { resolveActor: options.resolveActor, store: options.evidenceStore });
        }
        else {
            const unavailableEvidence = async (_request, reply) => reply.code(503).send({ error: 'evidence_service_not_configured' });
            app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/evidence', handler: unavailableEvidence });
        }
        if (options.investigationStore) {
            await registerInvestigationRoutes(app, { resolveActor: options.resolveActor, store: options.investigationStore });
        }
        else {
            const unavailableInvestigation = async (_request, reply) => reply.code(503).send({ error: 'investigation_service_not_configured' });
            app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/investigations', handler: unavailableInvestigation });
            app.route({ method: 'PATCH', url: '/v1/investigations/:investigationId', handler: unavailableInvestigation });
        }
        if (options.decisionActionStore) {
            await registerDecisionActionRoutes(app, { resolveActor: options.resolveActor, store: options.decisionActionStore });
        }
        else {
            const unavailableDecisionAction = async (_request, reply) => reply.code(503).send({ error: 'decision_action_service_not_configured' });
            app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/decisions', handler: unavailableDecisionAction });
            app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/actions', handler: unavailableDecisionAction });
            app.route({ method: 'PATCH', url: '/v1/actions/:actionId', handler: unavailableDecisionAction });
        }
        if (options.actionGapStore) {
            await registerActionGapRoutes(app, { resolveActor: options.resolveActor, store: options.actionGapStore, ...(options.workflowCaseStore ? { workflowCases: options.workflowCaseStore } : {}) });
        }
        else {
            const unavailableGap = async (_request, reply) => reply.code(503).send({ error: 'action_gap_service_not_configured' });
            app.route({ method: ['POST'], url: '/v1/action-gaps/evaluate', handler: unavailableGap });
            app.route({ method: 'POST', url: '/v1/action-gaps', handler: unavailableGap });
            app.route({ method: 'GET', url: '/v1/action-gaps', handler: unavailableGap });
            app.route({ method: 'PATCH', url: '/v1/action-gaps/:id/review', handler: unavailableGap });
        }
        if (options.actionHandoffStore) {
            await registerActionHandoffRoutes(app, { resolveActor: options.resolveActor, store: options.actionHandoffStore });
        }
        else {
            const unavailableHandoffs = async (_request, reply) => reply.code(503).send({ error: 'action_handoff_service_not_configured' });
            app.route({ method: ['GET', 'POST'], url: '/v1/actions/:actionId/handoffs', handler: unavailableHandoffs });
        }
        if (options.outcomeStore) {
            await registerOutcomeRoutes(app, { resolveActor: options.resolveActor, store: options.outcomeStore });
        }
        else {
            const unavailableOutcome = async (_request, reply) => reply.code(503).send({ error: 'outcome_service_not_configured' });
            app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/outcomes', handler: unavailableOutcome });
        }
        if (options.actionCostStore) {
            await registerActionCostRoutes(app, { resolveActor: options.resolveActor, store: options.actionCostStore });
        }
        else {
            const unavailableCosts = async (_request, reply) => reply.code(503).send({ error: 'action_cost_service_not_configured' });
            app.route({ method: ['GET', 'POST'], url: '/v1/actions/:actionId/costs', handler: unavailableCosts });
            app.route({ method: 'GET', url: '/v1/costs/summary', handler: unavailableCosts });
        }
        if (options.stockStore) {
            await registerStockRoutes(app, { resolveActor: options.resolveActor, store: options.stockStore });
        }
        else {
            const unavailableStock = async (_request, reply) => reply.code(503).send({ error: 'stock_service_not_configured' });
            app.route({ method: 'POST', url: '/v1/stock/snapshots', handler: unavailableStock });
            app.route({ method: 'GET', url: '/v1/stock/forecast', handler: unavailableStock });
        }
        if (options.communityIntake) {
            await registerCommunityIntakeRoutes(app, { resolveActor: options.resolveActor, ...options.communityIntake });
        }
        else {
            const unavailableIntake = async (_request, reply) => reply.code(503).send({ error: 'community_intake_not_configured' });
            app.route({ method: 'POST', url: '/inbound/community/ussd', handler: unavailableIntake });
            app.route({ method: 'POST', url: '/inbound/community/sms', handler: unavailableIntake });
            app.route({ method: 'GET', url: '/v1/community-intake/queue', handler: unavailableIntake });
            app.route({ method: 'GET', url: '/v1/community-intake/stats', handler: unavailableIntake });
            app.route({ method: 'POST', url: '/v1/community-intake/:submissionId/review', handler: unavailableIntake });
        }
        if (options.membershipStore) {
            await registerMembershipRoutes(app, { resolveActor: options.resolveActor, store: options.membershipStore, ...(options.verifyToken ? { verifyToken: options.verifyToken } : {}) });
        }
        else {
            const unavailableMembership = async (_request, reply) => reply.code(503).send({ error: 'membership_service_not_configured' });
            app.route({ method: 'GET', url: '/v1/members', handler: unavailableMembership });
            app.route({ method: 'PATCH', url: '/v1/members/:userId', handler: unavailableMembership });
            app.route({ method: ['GET', 'POST'], url: '/v1/invitations', handler: unavailableMembership });
            app.route({ method: 'POST', url: '/v1/invitations/:invitationId/revoke', handler: unavailableMembership });
            app.route({ method: 'POST', url: '/v1/invitations/redeem', handler: unavailableMembership });
        }
        if (options.contextStore) {
            await registerContextRoutes(app, { resolveActor: options.resolveActor, store: options.contextStore });
        }
        else {
            const unavailableContext = async (_request, reply) => reply.code(503).send({ error: 'context_service_not_configured' });
            app.route({ method: ['GET', 'POST'], url: '/v1/context/observations', handler: unavailableContext });
            app.route({ method: 'GET', url: '/v1/signals/:signalId/context', handler: unavailableContext });
        }
        if (options.learningStore) {
            await registerLearningRoutes(app, { resolveActor: options.resolveActor, store: options.learningStore });
        }
        else {
            const unavailableLearning = async (_request, reply) => reply.code(503).send({ error: 'learning_service_not_configured' });
            app.route({ method: 'GET', url: '/v1/learning/operational-patterns', handler: unavailableLearning });
            app.route({ method: 'GET', url: '/v1/learning/outcome-decay', handler: unavailableLearning });
            app.route({ method: 'GET', url: '/v1/learning/persistent-problems', handler: unavailableLearning });
        }
        if (options.reporterFeedbackStore) {
            await registerReporterFeedbackRoutes(app, { resolveActor: options.resolveActor, store: options.reporterFeedbackStore });
        }
        else {
            const unavailableFeedback = async (_request, reply) => reply.code(503).send({ error: 'reporter_feedback_service_not_configured' });
            app.route({ method: 'POST', url: '/v1/signals/:signalId/reporter-feedback', handler: unavailableFeedback });
        }
        if (options.interoperabilityStore) {
            await registerInteroperabilityRoutes(app, { resolveActor: options.resolveActor, store: options.interoperabilityStore });
            if (options.upstreamIngestionStore) {
                await registerUpstreamEventRoutes(app, { resolveActor: options.resolveActor, store: options.upstreamIngestionStore, interoperabilityStore: options.interoperabilityStore });
            }
            else {
                app.post('/v1/interoperability/upstream/dhis2/events', async (_request, reply) => reply.code(503).send({ error: 'upstream_ingestion_service_not_configured' }));
            }
        }
        else {
            const unavailableInterop = async (_request, reply) => reply.code(503).send({ error: 'interoperability_service_not_configured' });
            app.route({ method: 'GET', url: '/v1/interoperability/programmes', handler: unavailableInterop });
            app.route({ method: 'GET', url: '/v1/interoperability/integration-profiles', handler: unavailableInterop });
            app.route({ method: 'POST', url: '/v1/interoperability/exchange-requests', handler: unavailableInterop });
            app.route({ method: 'GET', url: '/v1/interoperability/countries', handler: unavailableInterop });
            app.route({ method: 'GET', url: '/v1/interoperability/indicators', handler: unavailableInterop });
            app.route({ method: ['GET', 'POST'], url: '/v1/governance/sharing-policies', handler: unavailableInterop });
        }
    }
    else {
        const unavailable = async (_request, reply) => reply.code(503).send({ error: 'signal_service_not_configured' });
        app.route({ method: ['GET', 'POST'], url: '/v1/signals', handler: unavailable });
        app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/evidence', handler: async (_request, reply) => reply.code(503).send({ error: 'evidence_service_not_configured' }) });
        const unavailableInvestigation = async (_request, reply) => reply.code(503).send({ error: 'investigation_service_not_configured' });
        const unavailableDecisionAction = async (_request, reply) => reply.code(503).send({ error: 'decision_action_service_not_configured' });
        app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/investigations', handler: unavailableInvestigation });
        app.route({ method: 'PATCH', url: '/v1/investigations/:investigationId', handler: unavailableInvestigation });
        app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/decisions', handler: unavailableDecisionAction });
        app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/actions', handler: unavailableDecisionAction });
        app.route({ method: 'PATCH', url: '/v1/actions/:actionId', handler: unavailableDecisionAction });
        app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/outcomes', handler: async (_request, reply) => reply.code(503).send({ error: 'outcome_service_not_configured' }) });
    }
    app.get('/health/ready', async (_request, reply) => {
        let database = 'not_configured';
        if (options.readinessCheck) {
            try {
                database = await options.readinessCheck() ? 'ok' : 'unavailable';
            }
            catch {
                database = 'unavailable';
            }
        }
        const ready = database === 'ok' && Boolean(options.resolveActor && options.signalStore && options.evidenceStore && options.investigationStore && options.decisionActionStore && options.auditStore && options.outcomeStore && options.actionGapStore && options.learningStore && options.interoperabilityStore && options.actionHandoffStore && options.reporterFeedbackStore && options.upstreamIngestionStore);
        return reply.code(ready ? 200 : 503).send({
            status: ready ? 'ok' : 'not_ready',
            checks: { database, identity: options.resolveActor ? 'configured' : 'not_configured', signalStore: options.signalStore ? 'configured' : 'not_configured', evidenceStore: options.evidenceStore ? 'configured' : 'not_configured', investigationStore: options.investigationStore ? 'configured' : 'not_configured', decisionActionStore: options.decisionActionStore ? 'configured' : 'not_configured', outcomeStore: options.outcomeStore ? 'configured' : 'not_configured', actionGapStore: options.actionGapStore ? 'configured' : 'not_configured', learningStore: options.learningStore ? 'configured' : 'not_configured', interoperabilityStore: options.interoperabilityStore ? 'configured' : 'not_configured', actionHandoffStore: options.actionHandoffStore ? 'configured' : 'not_configured', reporterFeedbackStore: options.reporterFeedbackStore ? 'configured' : 'not_configured', upstreamIngestionStore: options.upstreamIngestionStore ? 'configured' : 'not_configured', auditStore: options.auditStore ? 'configured' : 'not_configured' }
        });
    });
    app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: 'not_found', requestId: request.id }));
    app.setErrorHandler((error, request, reply) => {
        // Never serialize the full error object: database/identity-provider errors can
        // contain query text, connection details, or other sensitive operational data.
        request.log.error({
            requestId: request.id,
            errorName: error instanceof Error ? error.name : 'unknown_error',
            errorCode: typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
                ? error.code
                : undefined
        }, 'request failed');
        const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
            ? error.statusCode
            : undefined;
        const status = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 ? statusCode : 500;
        return reply.code(status).send({ error: status === 500 ? 'internal_error' : 'request_error', requestId: request.id });
    });
    return app;
}
