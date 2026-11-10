import { z } from 'zod';
import { publicHealthNarrative } from './data-boundary.js';
export const ACTION_COST_KINDS = ['planned', 'actual'];
export const ACTION_COST_CATEGORIES = ['personnel', 'supplies', 'transport', 'laboratory', 'communication', 'training', 'infrastructure', 'other'];
/** A cost entry is bounded evidence about resources spent on an action; it never carries personal data. */
export const ActionCostEntrySchema = z.object({
    costKind: z.enum(ACTION_COST_KINDS),
    costCategory: z.enum(ACTION_COST_CATEGORIES),
    // Mirrors numeric(14,2) with a 100 billion ceiling; at most two decimal places.
    amount: z.number().finite().min(0).max(100_000_000_000).refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: 'amount allows at most two decimal places' }),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    incurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: publicHealthNarrative(z.string().trim().min(3).max(500)).optional()
}).strict().superRefine((value, ctx) => {
    const d = new Date(`${value.incurredOn}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value.incurredOn) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['incurredOn'], message: 'incurredOn must be a real calendar date' });
    }
});
/** Totals never mix currencies or planned/actual: one row per (currency, kind). Cents are summed as integers. */
export function totalActionCosts(entries) {
    const sums = new Map();
    for (const e of entries) {
        const key = `${e.currencyCode}|${e.costKind}`;
        const cur = sums.get(key) ?? { currencyCode: e.currencyCode, costKind: e.costKind, cents: 0 };
        cur.cents += Math.round(e.amount * 100);
        sums.set(key, cur);
    }
    return [...sums.values()].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode) || a.costKind.localeCompare(b.costKind)).map((s) => ({ currencyCode: s.currencyCode, costKind: s.costKind, amount: s.cents / 100 }));
}
export const OUTCOME_RESULTS = ['improved', 'no_change', 'worsened', 'inconclusive'];
export function summarizeActionCost(input) {
    const outcomes = { improved: input.outcomes.improved ?? 0, no_change: input.outcomes.no_change ?? 0, worsened: input.outcomes.worsened ?? 0, inconclusive: input.outcomes.inconclusive ?? 0 };
    const totals = totalActionCosts(input.costs);
    const costPerImprovedAssessment = outcomes.improved > 0
        ? totals.filter((t) => t.costKind === 'actual').map((t) => ({ currencyCode: t.currencyCode, amount: Math.round((t.amount / outcomes.improved) * 100) / 100 }))
        : [];
    return { actionId: input.actionId, signalId: input.signalId, title: input.title, totals, outcomes, costPerImprovedAssessment };
}
