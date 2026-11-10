import { z } from 'zod';
export declare const ACTION_COST_KINDS: readonly ["planned", "actual"];
export declare const ACTION_COST_CATEGORIES: readonly ["personnel", "supplies", "transport", "laboratory", "communication", "training", "infrastructure", "other"];
/** A cost entry is bounded evidence about resources spent on an action; it never carries personal data. */
export declare const ActionCostEntrySchema: z.ZodEffects<z.ZodObject<{
    costKind: z.ZodEnum<["planned", "actual"]>;
    costCategory: z.ZodEnum<["personnel", "supplies", "transport", "laboratory", "communication", "training", "infrastructure", "other"]>;
    amount: z.ZodEffects<z.ZodNumber, number, number>;
    currencyCode: z.ZodString;
    incurredOn: z.ZodString;
    note: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    costKind: "planned" | "actual";
    costCategory: "personnel" | "supplies" | "transport" | "laboratory" | "communication" | "training" | "infrastructure" | "other";
    amount: number;
    currencyCode: string;
    incurredOn: string;
    note?: string | undefined;
}, {
    costKind: "planned" | "actual";
    costCategory: "personnel" | "supplies" | "transport" | "laboratory" | "communication" | "training" | "infrastructure" | "other";
    amount: number;
    currencyCode: string;
    incurredOn: string;
    note?: string | undefined;
}>, {
    costKind: "planned" | "actual";
    costCategory: "personnel" | "supplies" | "transport" | "laboratory" | "communication" | "training" | "infrastructure" | "other";
    amount: number;
    currencyCode: string;
    incurredOn: string;
    note?: string | undefined;
}, {
    costKind: "planned" | "actual";
    costCategory: "personnel" | "supplies" | "transport" | "laboratory" | "communication" | "training" | "infrastructure" | "other";
    amount: number;
    currencyCode: string;
    incurredOn: string;
    note?: string | undefined;
}>;
export type ActionCostEntry = z.infer<typeof ActionCostEntrySchema>;
export interface ActionCostTotal {
    currencyCode: string;
    costKind: (typeof ACTION_COST_KINDS)[number];
    amount: number;
}
/** Totals never mix currencies or planned/actual: one row per (currency, kind). Cents are summed as integers. */
export declare function totalActionCosts(entries: ReadonlyArray<Pick<ActionCostEntry, 'amount' | 'currencyCode' | 'costKind'>>): ActionCostTotal[];
export declare const OUTCOME_RESULTS: readonly ["improved", "no_change", "worsened", "inconclusive"];
export type OutcomeResultCounts = Record<(typeof OUTCOME_RESULTS)[number], number>;
export interface ActionCostSummary {
    actionId: string;
    signalId: string;
    title: string;
    totals: ActionCostTotal[];
    outcomes: OutcomeResultCounts;
    /** Actual cost divided by the number of assessments recorded as improved, per currency. Not cost per life saved; absent when nothing improved. */
    costPerImprovedAssessment: Array<{
        currencyCode: string;
        amount: number;
    }>;
}
export declare function summarizeActionCost(input: {
    actionId: string;
    signalId: string;
    title: string;
    costs: ReadonlyArray<Pick<ActionCostEntry, 'amount' | 'currencyCode' | 'costKind'>>;
    outcomes: Partial<OutcomeResultCounts>;
}): ActionCostSummary;
