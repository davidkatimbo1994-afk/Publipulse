import { z } from 'zod';
import type { AggregateExchangeRecord } from './interoperability-envelope.js';
export declare const FhirExchangeProfileSchema: z.ZodObject<{
    resourceType: z.ZodLiteral<"Bundle">;
    profile: z.ZodString;
    type: z.ZodEnum<["collection", "batch"]>;
    entryCount: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    type: "collection" | "batch";
    resourceType: "Bundle";
    profile: string;
    entryCount: number;
}, {
    type: "collection" | "batch";
    resourceType: "Bundle";
    profile: string;
    entryCount: number;
}>;
export type FhirExchangeProfile = z.infer<typeof FhirExchangeProfileSchema>;
/** Deterministic UTF-8 CSV representation for low-connectivity/offline exchange. */
export declare function serializeAggregateCsv(records: readonly AggregateExchangeRecord[]): string;
export declare function parseAggregateCsv(input: string): AggregateExchangeRecord[];
