import { z } from 'zod';
export declare const WeeklyDecisionInputSchema: z.ZodEffects<z.ZodObject<{
    clientMutationId: z.ZodString;
    weekStart: z.ZodString;
    weekEnd: z.ZodString;
    administrativeAreaCode: z.ZodString;
    agendaCode: z.ZodEnum<["ownership_gap", "unresolved_outcome", "recurrence", "response_blocker", "intervention_resistant", "feedback_gap", "integration_gap"]>;
    decision: z.ZodEnum<["continue_current_approach", "change_approach", "escalate_programme_redesign", "insufficient_evidence"]>;
    rationale: z.ZodString;
    nextCheckAt: z.ZodString;
    ownerRole: z.ZodEnum<["programme_lead", "district_lead", "surveillance_lead", "response_lead", "laboratory_lead", "other"]>;
    evidenceDigest: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    decision: "insufficient_evidence" | "continue_current_approach" | "change_approach" | "escalate_programme_redesign";
    rationale: string;
    administrativeAreaCode: string;
    clientMutationId: string;
    weekStart: string;
    weekEnd: string;
    agendaCode: "intervention_resistant" | "ownership_gap" | "unresolved_outcome" | "recurrence" | "response_blocker" | "feedback_gap" | "integration_gap";
    nextCheckAt: string;
    ownerRole: "other" | "programme_lead" | "district_lead" | "surveillance_lead" | "response_lead" | "laboratory_lead";
    evidenceDigest?: string | undefined;
}, {
    decision: "insufficient_evidence" | "continue_current_approach" | "change_approach" | "escalate_programme_redesign";
    rationale: string;
    administrativeAreaCode: string;
    clientMutationId: string;
    weekStart: string;
    weekEnd: string;
    agendaCode: "intervention_resistant" | "ownership_gap" | "unresolved_outcome" | "recurrence" | "response_blocker" | "feedback_gap" | "integration_gap";
    nextCheckAt: string;
    ownerRole: "other" | "programme_lead" | "district_lead" | "surveillance_lead" | "response_lead" | "laboratory_lead";
    evidenceDigest?: string | undefined;
}>, {
    decision: "insufficient_evidence" | "continue_current_approach" | "change_approach" | "escalate_programme_redesign";
    rationale: string;
    administrativeAreaCode: string;
    clientMutationId: string;
    weekStart: string;
    weekEnd: string;
    agendaCode: "intervention_resistant" | "ownership_gap" | "unresolved_outcome" | "recurrence" | "response_blocker" | "feedback_gap" | "integration_gap";
    nextCheckAt: string;
    ownerRole: "other" | "programme_lead" | "district_lead" | "surveillance_lead" | "response_lead" | "laboratory_lead";
    evidenceDigest?: string | undefined;
}, {
    decision: "insufficient_evidence" | "continue_current_approach" | "change_approach" | "escalate_programme_redesign";
    rationale: string;
    administrativeAreaCode: string;
    clientMutationId: string;
    weekStart: string;
    weekEnd: string;
    agendaCode: "intervention_resistant" | "ownership_gap" | "unresolved_outcome" | "recurrence" | "response_blocker" | "feedback_gap" | "integration_gap";
    nextCheckAt: string;
    ownerRole: "other" | "programme_lead" | "district_lead" | "surveillance_lead" | "response_lead" | "laboratory_lead";
    evidenceDigest?: string | undefined;
}>;
export type WeeklyDecisionInput = z.infer<typeof WeeklyDecisionInputSchema>;
