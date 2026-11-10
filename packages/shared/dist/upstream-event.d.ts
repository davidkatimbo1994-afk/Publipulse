import { z } from 'zod';
export declare const UpstreamProviderSchema: z.ZodEnum<["dhis2", "fhir", "other"]>;
export type UpstreamProvider = z.infer<typeof UpstreamProviderSchema>;
/** Provider-neutral event normalized before it can enter PubliPulse's outcome workflow. */
export declare const UpstreamEventSchema: z.ZodObject<{
    integrationProfileId: z.ZodString;
    provider: z.ZodEnum<["dhis2", "fhir", "other"]>;
    externalEventId: z.ZodString;
    contractVersion: z.ZodString;
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
    provider: "other" | "dhis2" | "fhir";
    observedAt: string;
    contractVersion: string;
    integrationProfileId: string;
    externalEventId: string;
    location: {
        precision: "community" | "district" | "facility";
        administrativeAreaCode: string;
    };
    sourceType: "other" | "facility_report" | "community_report" | "field_observation" | "research";
}, {
    summary: string;
    category: "other" | "unusual_illness" | "environmental_hazard" | "service_disruption";
    provider: "other" | "dhis2" | "fhir";
    observedAt: string;
    contractVersion: string;
    integrationProfileId: string;
    externalEventId: string;
    location: {
        precision: "community" | "district" | "facility";
        administrativeAreaCode: string;
    };
    sourceType: "other" | "facility_report" | "community_report" | "field_observation" | "research";
}>;
export type UpstreamEvent = z.infer<typeof UpstreamEventSchema>;
export declare const Dhis2UpstreamEventSchema: z.ZodObject<{
    integrationProfileId: z.ZodString;
    provider: z.ZodLiteral<"dhis2">;
    externalEventId: z.ZodString;
    contractVersion: z.ZodString;
    program: z.ZodString;
    orgUnit: z.ZodString;
    occurredAt: z.ZodString;
    category: z.ZodEnum<["unusual_illness", "environmental_hazard", "service_disruption", "other"]>;
    summary: z.ZodEffects<z.ZodString, string, string>;
    sourceType: z.ZodEnum<["community_report", "facility_report", "field_observation", "research", "other"]>;
}, "strict", z.ZodTypeAny, {
    summary: string;
    category: "other" | "unusual_illness" | "environmental_hazard" | "service_disruption";
    provider: "dhis2";
    contractVersion: string;
    integrationProfileId: string;
    externalEventId: string;
    sourceType: "other" | "facility_report" | "community_report" | "field_observation" | "research";
    program: string;
    orgUnit: string;
    occurredAt: string;
}, {
    summary: string;
    category: "other" | "unusual_illness" | "environmental_hazard" | "service_disruption";
    provider: "dhis2";
    contractVersion: string;
    integrationProfileId: string;
    externalEventId: string;
    sourceType: "other" | "facility_report" | "community_report" | "field_observation" | "research";
    program: string;
    orgUnit: string;
    occurredAt: string;
}>;
export type Dhis2UpstreamEvent = z.infer<typeof Dhis2UpstreamEventSchema>;
export declare function normalizeDhis2UpstreamEvent(input: Dhis2UpstreamEvent): UpstreamEvent;
