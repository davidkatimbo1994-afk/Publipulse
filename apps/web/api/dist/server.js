import { buildApp } from './app.js';
import { createOidcActorResolver, createOidcVerifier } from './auth/oidc-actor-resolver.js';
import { PostgresSignalStore } from './postgres-signal-store.js';
import { PostgresEvidenceStore } from './postgres-evidence-store.js';
import { PostgresInvestigationStore } from './postgres-investigation-store.js';
import { PostgresDecisionActionStore } from './postgres-decision-action-store.js';
import { PostgresAuditStore } from './postgres-audit-store.js';
import { PostgresOutcomeStore } from './postgres-outcome-store.js';
import { PostgresActionCostStore } from './postgres-action-cost-store.js';
import { loadCommunityIntakeConfig } from './community-intake-config.js';
import { createCommunityIntakeService } from './community-intake-service.js';
import { PostgresCommunityIntakeStore } from './postgres-community-intake-store.js';
import { PostgresMembershipStore } from './postgres-membership-store.js';
import { PostgresStockStore } from './postgres-stock-store.js';
import { PostgresContextStore } from './postgres-context-store.js';
import { PostgresActionGapStore } from './postgres-action-gap-store.js';
import { PostgresWorkflowCaseStore } from './action-gap/workflow-case-store.js';
import { PostgresPoolAdapter } from './postgres-pool.js';
import { PostgresLearningStore } from './postgres-learning-store.js';
import { PostgresInteroperabilityStore } from './postgres-interoperability-store.js';
import { PostgresActionHandoffStore } from './postgres-action-handoff-store.js';
import { PostgresReporterFeedbackStore } from './postgres-reporter-feedback-store.js';
import { PostgresUpstreamIngestionStore } from './upstream-ingestion-store.js';
import { parseApiPort, validateProductionServiceConfig } from './server-config.js';
const port = parseApiPort(process.env.API_PORT);
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;
const issuer = process.env.OIDC_ISSUER;
const audience = process.env.OIDC_AUDIENCE;
const jwksUrl = process.env.OIDC_JWKS_URL;
const configured = Boolean(databaseUrl && issuer && audience && jwksUrl);
// Validate production connection/auth settings before constructing a pool or opening sockets.
validateProductionServiceConfig(process.env.NODE_ENV, {
    ...(databaseUrl !== undefined ? { databaseUrl } : {}),
    ...(issuer !== undefined ? { issuer } : {}),
    ...(audience !== undefined ? { audience } : {}),
    ...(jwksUrl !== undefined ? { jwksUrl } : {}),
    ...(process.env.WEB_ORIGIN !== undefined ? { webOrigin: process.env.WEB_ORIGIN } : {})
});
let pool;
let app;
if (configured) {
    pool = new PostgresPoolAdapter(databaseUrl, isProduction);
    // Community USSD/SMS intake is off unless fully configured. A half-configured service stops start-up instead of running open.
    const intake = loadCommunityIntakeConfig(process.env);
    if (intake.status === 'invalid')
        throw new Error(`Community intake configuration is invalid: ${intake.problems.join('; ')}`);
    const communityStore = new PostgresCommunityIntakeStore(pool);
    const verifyToken = createOidcVerifier({ issuer: issuer, audience: audience, jwksUrl: jwksUrl });
    app = await buildApp({
        ...(process.env.NODE_ENV ? { environment: process.env.NODE_ENV } : {}),
        ...(process.env.WEB_ORIGIN ? { allowedOrigin: process.env.WEB_ORIGIN } : {}),
        resolveActor: createOidcActorResolver(pool, verifyToken),
        signalStore: new PostgresSignalStore(pool),
        evidenceStore: new PostgresEvidenceStore(pool),
        investigationStore: new PostgresInvestigationStore(pool),
        decisionActionStore: new PostgresDecisionActionStore(pool),
        auditStore: new PostgresAuditStore(pool),
        outcomeStore: new PostgresOutcomeStore(pool),
        actionCostStore: new PostgresActionCostStore(pool),
        stockStore: new PostgresStockStore(pool),
        membershipStore: new PostgresMembershipStore(pool),
        verifyToken,
        ...(intake.status === 'ready' ? { communityIntake: { store: communityStore, service: createCommunityIntakeService({ config: intake.config, store: communityStore }), config: intake.config } } : {}),
        contextStore: new PostgresContextStore(pool),
        actionGapStore: new PostgresActionGapStore(pool),
        workflowCaseStore: new PostgresWorkflowCaseStore(pool),
        learningStore: new PostgresLearningStore(pool),
        interoperabilityStore: new PostgresInteroperabilityStore(pool),
        actionHandoffStore: new PostgresActionHandoffStore(pool),
        reporterFeedbackStore: new PostgresReporterFeedbackStore(pool),
        upstreamIngestionStore: new PostgresUpstreamIngestionStore(pool),
        readinessCheck: () => pool.check()
    });
    app.addHook('onClose', async () => { await pool?.close(); });
}
else {
    app = await buildApp();
    app.log.warn('Signal service is fail-closed: configure DATABASE_URL and OIDC settings to enable it');
}
try {
    await app.listen({ port, host: '0.0.0.0' });
}
catch (error) {
    app.log.error(error);
    process.exitCode = 1;
    await app.close();
}
const shutdown = async (signal) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
};
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
