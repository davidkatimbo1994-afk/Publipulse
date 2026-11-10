import { z } from 'zod';
/** Public intake contract deliberately excludes direct patient identifiers. */
export declare const SignalIntakeSchema: z.ZodObject<{
    clientSubmissionId: z.ZodString;
    category: z.ZodEnum<["unusual_illness", "environmental_hazard", "service_disruption", "other"]>;
    summary: z.ZodEffects<z.ZodString, string, string>;
    observedAt: z.ZodString;
    location: z.ZodObject<{
        administrativeAreaCode: z.ZodString;
        precision: z.ZodEnum<["community", "facility", "district"]>;
    }, "strict", z.ZodTypeAny, {
        precision: "community" | "district" | "facility";
        administrativeAreaCode: string;
    }, {
        precision: "community" | "district" | "facility";
        administrativeAreaCode: string;
    }>;
    sourceType: z.ZodEnum<["community_report", "facility_report", "field_observation", "research", "other"]>;
}, "strict", z.ZodTypeAny, {
    summary: string;
    category: "other" | "unusual_illness" | "environmental_hazard" | "service_disruption";
    observedAt: string;
    location: {
        precision: "community" | "district" | "facility";
        administrativeAreaCode: string;
    };
    sourceType: "other" | "facility_report" | "community_report" | "field_observation" | "research";
    clientSubmissionId: string;
}, {
    summary: string;
    category: "other" | "unusual_illness" | "environmental_hazard" | "service_disruption";
    observedAt: string;
    location: {
        precision: "community" | "district" | "facility";
        administrativeAreaCode: string;
    };
    sourceType: "other" | "facility_report" | "community_report" | "field_observation" | "research";
    clientSubmissionId: string;
}>;
export type SignalIntake = z.infer<typeof SignalIntakeSchema>;
export declare const SignalStatusSchema: z.ZodEnum<["submitted", "under_review", "investigating", "verified", "dismissed", "closed"]>;
export declare const SignalStatusTransitionSchema: z.ZodObject<{
    status: z.ZodEnum<["under_review", "investigating", "verified", "dismissed", "closed"]>;
    expectedVersion: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    status: "verified" | "under_review" | "investigating" | "dismissed" | "closed";
    expectedVersion: number;
}, {
    status: "verified" | "under_review" | "investigating" | "dismissed" | "closed";
    expectedVersion: number;
}>;
export type SignalStatus = z.infer<typeof SignalStatusSchema>;
export type SignalStatusTransition = z.infer<typeof SignalStatusTransitionSchema>;
/** Evidence metadata only; raw documents and patient-level records are not uploaded by this API. */
export declare const EvidenceIntakeSchema: z.ZodObject<{
    evidenceType: z.ZodEnum<["document_reference", "field_note", "aggregate_measurement", "official_report", "other"]>;
    description: z.ZodEffects<z.ZodString, string, string>;
    sourceLabel: z.ZodString;
    sourceUri: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    observedAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    description: string;
    sourceLabel: string;
    evidenceType: "other" | "document_reference" | "field_note" | "aggregate_measurement" | "official_report";
    observedAt?: string | undefined;
    sourceUri?: string | undefined;
}, {
    description: string;
    sourceLabel: string;
    evidenceType: "other" | "document_reference" | "field_note" | "aggregate_measurement" | "official_report";
    observedAt?: string | undefined;
    sourceUri?: string | undefined;
}>;
export type EvidenceIntake = z.infer<typeof EvidenceIntakeSchema>;
/** Investigation records contain findings and uncertainty, not direct patient identifiers. */
export declare const InvestigationIntakeSchema: z.ZodObject<{
    ownerUserId: z.ZodString;
    initialNote: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    ownerUserId: string;
    initialNote?: string | undefined;
}, {
    ownerUserId: string;
    initialNote?: string | undefined;
}>;
export type InvestigationIntake = z.infer<typeof InvestigationIntakeSchema>;
export declare const InvestigationUpdateSchema: z.ZodEffects<z.ZodObject<{
    expectedVersion: z.ZodNumber;
    status: z.ZodOptional<z.ZodEnum<["open", "awaiting_information", "completed", "cancelled"]>>;
    findings: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
    uncertaintyNote: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
}, "strict", z.ZodTypeAny, {
    expectedVersion: number;
    status?: "open" | "completed" | "cancelled" | "awaiting_information" | undefined;
    uncertaintyNote?: string | null | undefined;
    findings?: string | null | undefined;
}, {
    expectedVersion: number;
    status?: "open" | "completed" | "cancelled" | "awaiting_information" | undefined;
    uncertaintyNote?: string | null | undefined;
    findings?: string | null | undefined;
}>, {
    expectedVersion: number;
    status?: "open" | "completed" | "cancelled" | "awaiting_information" | undefined;
    uncertaintyNote?: string | null | undefined;
    findings?: string | null | undefined;
}, {
    expectedVersion: number;
    status?: "open" | "completed" | "cancelled" | "awaiting_information" | undefined;
    uncertaintyNote?: string | null | undefined;
    findings?: string | null | undefined;
}>;
export type InvestigationUpdate = z.infer<typeof InvestigationUpdateSchema>;
export { DecisionIntakeSchema, ResponseActionIntakeSchema, ResponseActionUpdateSchema } from './decision-action.js';
export type { DecisionIntake, ResponseActionIntake, ResponseActionUpdate } from './decision-action.js';
export { OutcomeAssessmentSchema } from './outcome-assessment.js';
export type { OutcomeAssessment } from './outcome-assessment.js';
export { ActionCostEntrySchema, totalActionCosts, summarizeActionCost } from './action-cost.js';
export type { ActionCostEntry, ActionCostTotal, ActionCostSummary, OutcomeResultCounts } from './action-cost.js';
export { StockSnapshotSchema, forecastStock, buildSeriesForecast } from './stock-forecast.js';
export type { StockSnapshot, StockForecast, StockSeriesForecast, StockPoint, StockAlertLevel } from './stock-forecast.js';
export { ExternalContextObservationSchema, compareContextToBaseline, contextWindowFor } from './external-context.js';
export type { ExternalContextObservation, ContextComparison, ContextValue } from './external-context.js';
export { RootCauseMechanismSchema, RootCauseStatusSchema, RootCauseHypothesisSchema, compareRecurrenceObservations, classifyRecurrencePattern } from './outcome-root-cause.js';
export type { RootCauseMechanism, RootCauseStatus, RootCauseHypothesis, RecurrenceClusterObservation, RecurrenceSimilarity, RecurrenceAssessment } from './outcome-root-cause.js';
export { CountryCodeSchema, ProgrammeCodeSchema, IndicatorCodeSchema, CountryConfigSchema, ProgrammeConfigSchema, IndicatorDefinitionSchema, DataSharingPolicySchema, IntegrationProfileSchema } from './interoperability.js';
export type { CountryConfig, ProgrammeConfig, IndicatorDefinition, DataSharingPolicy, IntegrationProfile } from './interoperability.js';
export { InteroperabilityContractSchema, ExchangeReceiptSchema, InteroperabilityContractVersionSchema, ExchangeDirectionSchema, ExchangeModeSchema, InteroperabilityProviderSchema, ExchangeJobStatusSchema, ExchangeRejectionCodeSchema, normalizeIndicatorCodes, stableContractFingerprint } from './interoperability-contract.js';
export type { InteroperabilityContract, ExchangeReceipt, ExchangeTransport } from './interoperability-contract.js';
export { ExchangeFormatSchema, ExchangeEnvelopeSchema, applyMinimumCellSuppression, canonicalAggregatePayload } from './interoperability-envelope.js';
export type { ExchangeFormat, ExchangeEnvelope, AggregateExchangeRecord } from './interoperability-envelope.js';
export { FhirExchangeProfileSchema, serializeAggregateCsv, parseAggregateCsv } from './interoperability-offline.js';
export type { FhirExchangeProfile } from './interoperability-offline.js';
export { publicHealthNarrative, findDirectIdentifierPattern } from './data-boundary.js';
export { SevenOneSevenSchema, sevenOneSevenClocks } from './outcome-clocks.js';
export type { SevenOneSevenInput } from './outcome-clocks.js';
export { OfflineActionUpdateSchema, OfflineOutcomeAssessmentSchema, OfflineWorkflowMutationSchema, classifyOfflineReplay } from './offline-workflow.js';
export type { OfflineWorkflowMutation } from './offline-workflow.js';
export { UpstreamProviderSchema, UpstreamEventSchema, Dhis2UpstreamEventSchema, normalizeDhis2UpstreamEvent } from './upstream-event.js';
export type { UpstreamProvider, UpstreamEvent, Dhis2UpstreamEvent } from './upstream-event.js';
export { ReconciliationStatusSchema, ReconciliationInputSchema, ReconciliationSnapshotInputSchema, reconcileExchange, evidenceDigestInput } from './interoperability-reconciliation.js';
export type { ReconciliationStatus, ReconciliationInput, ReconciliationResult, ReconciliationSnapshotInput } from './interoperability-reconciliation.js';
export { MEMBER_ROLES, INVITATION_MAX_DAYS, INVITATION_DEFAULT_DAYS, INVITATION_CODE_PATTERN, canManageMembers, assignableRoles, decideMemberChange, wouldRemoveLastOwner, invitationStatus, isMemberRole } from './membership-rules.js';
export type { MemberRole, MemberChangeDecision, InvitationStatus } from './membership-rules.js';
export { MemberRoleSchema, InvitationCreateSchema, InvitationRedeemSchema, MemberChangeSchema, OrganizationProvisionSchema } from './membership.js';
export type { InvitationCreate, InvitationRedeem, MemberChange, OrganizationProvision } from './membership.js';
export { CONSENT_VERSION, COMMUNITY_CATEGORIES, NOTE_MAX_LENGTH, DEFAULT_MESSAGES, categoryMenu, areaMenu, validateFlowConfig, handleUssd, handleSms, smsHelp } from './community-flow.js';
export type { CommunityCategoryKey, CommunityArea, CommunityMessages, CommunityFlowConfig, CommunitySubmissionInput, FlowOutcome } from './community-flow.js';
export { CommunityReviewSchema, DEFAULT_COMMUNITY_LIMITS } from './community-intake.js';
export type { CommunityReview, CommunityLimits } from './community-intake.js';
