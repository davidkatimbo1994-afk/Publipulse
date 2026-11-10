import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { registerSignalRoutes } from './signal-routes.js';
import type { ActorResolver, SignalStore } from './signal-store.js';
import { registerEvidenceRoutes } from './evidence-routes.js';
import type { EvidenceStore } from './evidence-store.js';
import { registerInvestigationRoutes } from './investigation-routes.js';
import type { InvestigationStore } from './investigation-store.js';
import { registerDecisionActionRoutes } from './decision-action-routes.js';
import type { DecisionActionStore } from './decision-action-store.js';
import { registerAuditRoutes } from './audit-routes.js';
import type { AuditStore } from './audit-store.js';
import { registerOutcomeRoutes } from './outcome-routes.js';
import { registerActionCostRoutes } from './action-cost-routes.js';
import type { ActionCostStore } from './action-cost-store.js';
import { registerCommunityIntakeRoutes } from './community-intake-routes.js';
import type { CommunityIntakeStore } from './community-intake-store.js';
import type { CommunityIntakeService } from './community-intake-service.js';
import type { CommunityIntakeConfig } from './community-intake-config.js';
import type { OutboundSmsSender } from './gateway-africastalking.js';
import { registerMembershipRoutes } from './membership-routes.js';
import type { MembershipStore } from './membership-store.js';
import type { AccessTokenVerifier } from './auth/oidc-actor-resolver.js';
import { registerStockRoutes } from './stock-routes.js';
import type { StockStore } from './stock-store.js';
import { registerContextRoutes } from './context-routes.js';
import type { ContextStore } from './context-store.js';
import type { OutcomeStore } from './outcome-store.js';
import { registerActionGapRoutes } from './action-gap-routes.js';
import type { ActionGapStore } from './action-gap-store.js';
import type { WorkflowCaseStore } from './action-gap/workflow-case-store.js';
import { registerActionHandoffRoutes } from './action-handoff-routes.js';
import type { ActionHandoffStore } from './action-handoff-store.js';
import { registerLearningRoutes } from './learning-routes.js';
import type { LearningStore } from './learning-store.js';
import { registerInteroperabilityRoutes } from './interoperability-routes.js';
import type { InteroperabilityStore } from './interoperability-store.js';
import { registerReporterFeedbackRoutes } from './reporter-feedback-routes.js';
import type { ReporterFeedbackStore } from './reporter-feedback-store.js';
import { registerUpstreamEventRoutes } from './upstream-event-routes.js';
import type { UpstreamIngestionStore } from './upstream-ingestion-store.js';
import { parseWebOrigins } from './server-config.js';

export interface AppOptions {
  environment?: string;
  /** One exact browser origin, or several separated by commas. */
  allowedOrigin?: string;
  resolveActor?: ActorResolver;
  signalStore?: SignalStore;
  evidenceStore?: EvidenceStore;
  investigationStore?: InvestigationStore;
  decisionActionStore?: DecisionActionStore;
  auditStore?: AuditStore;
  outcomeStore?: OutcomeStore;
  actionCostStore?: ActionCostStore;
  stockStore?: StockStore;
  membershipStore?: MembershipStore;
  /** Community USSD/SMS intake. All four are needed; without them the routes answer 503. */
  communityIntake?: { store: CommunityIntakeStore; service: CommunityIntakeService; config: CommunityIntakeConfig; smsSender?: OutboundSmsSender };
  /** Verifies an access token without needing a membership; used only to redeem an invitation. */
  verifyToken?: AccessTokenVerifier;
  contextStore?: ContextStore;
  actionGapStore?: ActionGapStore;
  workflowCaseStore?: WorkflowCaseStore;
  actionHandoffStore?: ActionHandoffStore;
  learningStore?: LearningStore;
  interoperabilityStore?: InteroperabilityStore;
  reporterFeedbackStore?: ReporterFeedbackStore;
  upstreamIngestionStore?: UpstreamIngestionStore;
  readinessCheck?: () => Promise<boolean>;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const isProduction = (options.environment ?? process.env.NODE_ENV) === 'production';
  const configuredOrigin = options.allowedOrigin ?? process.env.WEB_ORIGIN;
  if (isProduction && !configuredOrigin) throw new Error('WEB_ORIGIN must be explicitly configured in production');
  // WEB_ORIGIN may list several exact origins, comma-separated (for example web command center + field PWA).
  const allowedOrigins = new Set(parseWebOrigins(configuredOrigin ?? 'http://localhost:5173', isProduction));
  const app: FastifyInstance = Fastify({
    logger: {
      level: isProduction ? 'info' : 'debug',
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.email', '*.phone'],
        censor: '[REDACTED]'
      },
      // Fastify's serializer type requires type/message/stack; message and stack are
      // deliberately redacted so error text (which can embed request data) never reaches logs.
      serializers: {
        err: (error: Error) => ({
          type: error.name,
          name: error.name,
          message: '[REDACTED]',
          stack: '[REDACTED]',
          ...(typeof (error as Error & { code?: unknown }).code === 'string'
            ? { code: (error as Error & { code: string }).code }
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
    if (request.method === 'OPTIONS') return reply.code(204).send();
  });

  app.get('/health/live', async () => ({ status: 'ok' }));

  if (options.resolveActor && options.auditStore) {
    await registerAuditRoutes(app, { resolveActor: options.resolveActor, store: options.auditStore });
  } else {
    app.get('/v1/audit-events', async (_request, reply) => reply.code(503).send({ error: 'audit_service_not_configured' }));
  }

  if (options.resolveActor && options.signalStore) {
    await registerSignalRoutes(app, { resolveActor: options.resolveActor, store: options.signalStore });
    if (options.evidenceStore) {
      await registerEvidenceRoutes(app, { resolveActor: options.resolveActor, store: options.evidenceStore });
    } else {
      const unavailableEvidence = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'evidence_service_not_configured' });
      app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/evidence', handler: unavailableEvidence as never });
    }
    if (options.investigationStore) {
      await registerInvestigationRoutes(app, { resolveActor: options.resolveActor, store: options.investigationStore });
    } else {
      const unavailableInvestigation = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'investigation_service_not_configured' });
      app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/investigations', handler: unavailableInvestigation as never });
      app.route({ method: 'PATCH', url: '/v1/investigations/:investigationId', handler: unavailableInvestigation as never });
    }
    if (options.decisionActionStore) {
      await registerDecisionActionRoutes(app, { resolveActor: options.resolveActor, store: options.decisionActionStore });
    } else {
      const unavailableDecisionAction = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'decision_action_service_not_configured' });
      app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/decisions', handler: unavailableDecisionAction as never });
      app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/actions', handler: unavailableDecisionAction as never });
      app.route({ method: 'PATCH', url: '/v1/actions/:actionId', handler: unavailableDecisionAction as never });
    }
    if (options.actionGapStore) {
      await registerActionGapRoutes(app, { resolveActor: options.resolveActor, store: options.actionGapStore, ...(options.workflowCaseStore ? { workflowCases: options.workflowCaseStore } : {}) });
    } else {
      const unavailableGap = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'action_gap_service_not_configured' });
      app.route({ method: ['POST'], url: '/v1/action-gaps/evaluate', handler: unavailableGap as never });
      app.route({ method: 'POST', url: '/v1/action-gaps', handler: unavailableGap as never });
      app.route({ method: 'GET', url: '/v1/action-gaps', handler: unavailableGap as never });
      app.route({ method: 'PATCH', url: '/v1/action-gaps/:id/review', handler: unavailableGap as never });
    }
    if (options.actionHandoffStore) {
      await registerActionHandoffRoutes(app, { resolveActor: options.resolveActor, store: options.actionHandoffStore });
    } else {
      const unavailableHandoffs = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'action_handoff_service_not_configured' });
      app.route({ method: ['GET', 'POST'], url: '/v1/actions/:actionId/handoffs', handler: unavailableHandoffs as never });
    }
    if (options.outcomeStore) {
      await registerOutcomeRoutes(app, { resolveActor: options.resolveActor, store: options.outcomeStore });
    } else {
      const unavailableOutcome = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'outcome_service_not_configured' });
      app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/outcomes', handler: unavailableOutcome as never });
    }
    if (options.actionCostStore) {
      await registerActionCostRoutes(app, { resolveActor: options.resolveActor, store: options.actionCostStore });
    } else {
      const unavailableCosts = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'action_cost_service_not_configured' });
      app.route({ method: ['GET', 'POST'], url: '/v1/actions/:actionId/costs', handler: unavailableCosts as never });
      app.route({ method: 'GET', url: '/v1/costs/summary', handler: unavailableCosts as never });
    }
    if (options.stockStore) {
      await registerStockRoutes(app, { resolveActor: options.resolveActor, store: options.stockStore });
    } else {
      const unavailableStock = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'stock_service_not_configured' });
      app.route({ method: 'POST', url: '/v1/stock/snapshots', handler: unavailableStock as never });
      app.route({ method: 'GET', url: '/v1/stock/forecast', handler: unavailableStock as never });
    }
    if (options.communityIntake) {
      await registerCommunityIntakeRoutes(app, { resolveActor: options.resolveActor, ...options.communityIntake });
    } else {
      const unavailableIntake = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'community_intake_not_configured' });
      app.route({ method: 'POST', url: '/inbound/community/ussd', handler: unavailableIntake as never });
      app.route({ method: 'POST', url: '/inbound/community/sms', handler: unavailableIntake as never });
      app.route({ method: 'GET', url: '/v1/community-intake/queue', handler: unavailableIntake as never });
      app.route({ method: 'GET', url: '/v1/community-intake/stats', handler: unavailableIntake as never });
      app.route({ method: 'POST', url: '/v1/community-intake/:submissionId/review', handler: unavailableIntake as never });
    }
    if (options.membershipStore) {
      await registerMembershipRoutes(app, { resolveActor: options.resolveActor, store: options.membershipStore, ...(options.verifyToken ? { verifyToken: options.verifyToken } : {}) });
    } else {
      const unavailableMembership = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'membership_service_not_configured' });
      app.route({ method: 'GET', url: '/v1/members', handler: unavailableMembership as never });
      app.route({ method: 'PATCH', url: '/v1/members/:userId', handler: unavailableMembership as never });
      app.route({ method: ['GET', 'POST'], url: '/v1/invitations', handler: unavailableMembership as never });
      app.route({ method: 'POST', url: '/v1/invitations/:invitationId/revoke', handler: unavailableMembership as never });
      app.route({ method: 'POST', url: '/v1/invitations/redeem', handler: unavailableMembership as never });
    }
    if (options.contextStore) {
      await registerContextRoutes(app, { resolveActor: options.resolveActor, store: options.contextStore });
    } else {
      const unavailableContext = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'context_service_not_configured' });
      app.route({ method: ['GET', 'POST'], url: '/v1/context/observations', handler: unavailableContext as never });
      app.route({ method: 'GET', url: '/v1/signals/:signalId/context', handler: unavailableContext as never });
    }
    if (options.learningStore) {
      await registerLearningRoutes(app, { resolveActor: options.resolveActor, store: options.learningStore });
    } else {
      const unavailableLearning = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) => reply.code(503).send({ error: 'learning_service_not_configured' });
      app.route({ method: 'GET', url: '/v1/learning/operational-patterns', handler: unavailableLearning as never });
      app.route({ method: 'GET', url: '/v1/learning/outcome-decay', handler: unavailableLearning as never });
      app.route({ method: 'GET', url: '/v1/learning/persistent-problems', handler: unavailableLearning as never });
    }
    if (options.reporterFeedbackStore) {
      await registerReporterFeedbackRoutes(app, { resolveActor: options.resolveActor, store: options.reporterFeedbackStore });
    } else {
      const unavailableFeedback = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) => reply.code(503).send({ error: 'reporter_feedback_service_not_configured' });
      app.route({ method: 'POST', url: '/v1/signals/:signalId/reporter-feedback', handler: unavailableFeedback as never });
    }
    if (options.interoperabilityStore) {
      await registerInteroperabilityRoutes(app, { resolveActor: options.resolveActor, store: options.interoperabilityStore });
      if (options.upstreamIngestionStore) {
        await registerUpstreamEventRoutes(app, { resolveActor: options.resolveActor, store: options.upstreamIngestionStore, interoperabilityStore: options.interoperabilityStore });
      } else {
        app.post('/v1/interoperability/upstream/dhis2/events', async (_request, reply) => reply.code(503).send({ error: 'upstream_ingestion_service_not_configured' }));
      }
    } else {
      const unavailableInterop = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) => reply.code(503).send({ error: 'interoperability_service_not_configured' });
      app.route({ method: 'GET', url: '/v1/interoperability/programmes', handler: unavailableInterop as never });
      app.route({ method: 'GET', url: '/v1/interoperability/integration-profiles', handler: unavailableInterop as never });
      app.route({ method: 'POST', url: '/v1/interoperability/exchange-requests', handler: unavailableInterop as never });
      app.route({ method: 'GET', url: '/v1/interoperability/countries', handler: unavailableInterop as never });
      app.route({ method: 'GET', url: '/v1/interoperability/indicators', handler: unavailableInterop as never });
      app.route({ method: ['GET','POST'], url: '/v1/governance/sharing-policies', handler: unavailableInterop as never });
    }
  } else {
    const unavailable = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) =>
      reply.code(503).send({ error: 'signal_service_not_configured' });
    app.route({ method: ['GET', 'POST'], url: '/v1/signals', handler: unavailable as never });
    app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/evidence', handler: async (_request, reply) => reply.code(503).send({ error: 'evidence_service_not_configured' }) as never });
    const unavailableInvestigation = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'investigation_service_not_configured' });
    const unavailableDecisionAction = async (_request: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown }; }) => reply.code(503).send({ error: 'decision_action_service_not_configured' });
    app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/investigations', handler: unavailableInvestigation as never });
    app.route({ method: 'PATCH', url: '/v1/investigations/:investigationId', handler: unavailableInvestigation as never });
    app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/decisions', handler: unavailableDecisionAction as never });
    app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/actions', handler: unavailableDecisionAction as never });
    app.route({ method: 'PATCH', url: '/v1/actions/:actionId', handler: unavailableDecisionAction as never });
    app.route({ method: ['GET', 'POST'], url: '/v1/signals/:signalId/outcomes', handler: async (_request, reply) => reply.code(503).send({ error: 'outcome_service_not_configured' }) as never });
  }
  app.get('/health/ready', async (_request, reply) => {
    let database: 'ok' | 'unavailable' | 'not_configured' = 'not_configured';
    if (options.readinessCheck) {
      try { database = await options.readinessCheck() ? 'ok' : 'unavailable'; }
      catch { database = 'unavailable'; }
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
      errorCode: typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined
    }, 'request failed');
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? (error as { statusCode?: unknown }).statusCode
      : undefined;
    const status = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 ? statusCode : 500;
    return reply.code(status).send({ error: status === 500 ? 'internal_error' : 'request_error', requestId: request.id });
  });
  return app;
}
