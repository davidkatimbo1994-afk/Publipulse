import { z } from 'zod';
import { publicHealthNarrative } from './data-boundary.js';
/** Public intake contract deliberately excludes direct patient identifiers. */
export const SignalIntakeSchema = z.object({
    clientSubmissionId: z.string().uuid(),
    category: z.enum(['unusual_illness', 'environmental_hazard', 'service_disruption', 'other']),
    summary: publicHealthNarrative(z.string().trim().min(10).max(1000)),
    observedAt: z.string().datetime({ offset: true }),
    location: z.object({
        administrativeAreaCode: z.string().trim().min(1).max(80),
        precision: z.enum(['community', 'facility', 'district'])
    }).strict(),
    sourceType: z.enum(['community_report', 'facility_report', 'field_observation', 'research', 'other'])
}).strict();
export const SignalStatusSchema = z.enum(['submitted', 'under_review', 'investigating', 'verified', 'dismissed', 'closed']);
export const SignalStatusTransitionSchema = z.object({
    status: z.enum(['under_review', 'investigating', 'verified', 'dismissed', 'closed']),
    expectedVersion: z.number().int().min(1).max(2147483647)
}).strict();
/** Evidence metadata only; raw documents and patient-level records are not uploaded by this API. */
export const EvidenceIntakeSchema = z.object({
    evidenceType: z.enum(['document_reference', 'field_note', 'aggregate_measurement', 'official_report', 'other']),
    description: publicHealthNarrative(z.string().trim().min(3).max(2000)),
    sourceLabel: z.string().trim().min(1).max(240),
    sourceUri: z.string().url().max(2048).refine((value) => {
        try {
            const parsed = new URL(value);
            return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
        }
        catch {
            return false;
        }
    }, 'source URI must be HTTPS without embedded credentials').optional(),
    observedAt: z.string().datetime({ offset: true }).optional()
}).strict();
/** Investigation records contain findings and uncertainty, not direct patient identifiers. */
export const InvestigationIntakeSchema = z.object({
    ownerUserId: z.string().uuid(),
    initialNote: publicHealthNarrative(z.string().trim().max(3000)).optional()
}).strict();
export const InvestigationUpdateSchema = z.object({
    expectedVersion: z.number().int().min(1).max(2147483647),
    status: z.enum(['open', 'awaiting_information', 'completed', 'cancelled']).optional(),
    findings: publicHealthNarrative(z.string().trim().max(10000)).nullable().optional(),
    uncertaintyNote: publicHealthNarrative(z.string().trim().max(3000)).nullable().optional()
}).strict().refine((value) => value.status !== undefined || value.findings !== undefined || value.uncertaintyNote !== undefined, 'at least one update field is required');
export { DecisionIntakeSchema, ResponseActionIntakeSchema, ResponseActionUpdateSchema } from './decision-action.js';
// Outcome assessments require evidence and uncertainty; task completion alone is not impact proof.
export { OutcomeAssessmentSchema } from './outcome-assessment.js';
export { ActionCostEntrySchema, totalActionCosts, summarizeActionCost } from './action-cost.js';
export { StockSnapshotSchema, forecastStock, buildSeriesForecast } from './stock-forecast.js';
export { ExternalContextObservationSchema, compareContextToBaseline, contextWindowFor } from './external-context.js';
export { RootCauseMechanismSchema, RootCauseStatusSchema, RootCauseHypothesisSchema, compareRecurrenceObservations, classifyRecurrencePattern } from './outcome-root-cause.js';
export { CountryCodeSchema, ProgrammeCodeSchema, IndicatorCodeSchema, CountryConfigSchema, ProgrammeConfigSchema, IndicatorDefinitionSchema, DataSharingPolicySchema, IntegrationProfileSchema } from './interoperability.js';
export { InteroperabilityContractSchema, ExchangeReceiptSchema, InteroperabilityContractVersionSchema, ExchangeDirectionSchema, ExchangeModeSchema, InteroperabilityProviderSchema, ExchangeJobStatusSchema, ExchangeRejectionCodeSchema, normalizeIndicatorCodes, stableContractFingerprint } from './interoperability-contract.js';
export { ExchangeFormatSchema, ExchangeEnvelopeSchema, applyMinimumCellSuppression, canonicalAggregatePayload } from './interoperability-envelope.js';
export { FhirExchangeProfileSchema, serializeAggregateCsv, parseAggregateCsv } from './interoperability-offline.js';
export { publicHealthNarrative, findDirectIdentifierPattern } from './data-boundary.js';
export { SevenOneSevenSchema, sevenOneSevenClocks } from './outcome-clocks.js';
export { OfflineActionUpdateSchema, OfflineOutcomeAssessmentSchema, OfflineWorkflowMutationSchema, classifyOfflineReplay } from './offline-workflow.js';
export { UpstreamProviderSchema, UpstreamEventSchema, Dhis2UpstreamEventSchema, normalizeDhis2UpstreamEvent } from './upstream-event.js';
export { ReconciliationStatusSchema, ReconciliationInputSchema, ReconciliationSnapshotInputSchema, reconcileExchange, evidenceDigestInput } from './interoperability-reconciliation.js';
export { MEMBER_ROLES, INVITATION_MAX_DAYS, INVITATION_DEFAULT_DAYS, INVITATION_CODE_PATTERN, canManageMembers, assignableRoles, decideMemberChange, wouldRemoveLastOwner, invitationStatus, isMemberRole } from './membership-rules.js';
export { MemberRoleSchema, InvitationCreateSchema, InvitationRedeemSchema, MemberChangeSchema, OrganizationProvisionSchema } from './membership.js';
export { CONSENT_VERSION, COMMUNITY_CATEGORIES, NOTE_MAX_LENGTH, DEFAULT_MESSAGES, categoryMenu, areaMenu, validateFlowConfig, handleUssd, handleSms, smsHelp } from './community-flow.js';
export { CommunityReviewSchema, DEFAULT_COMMUNITY_LIMITS } from './community-intake.js';
