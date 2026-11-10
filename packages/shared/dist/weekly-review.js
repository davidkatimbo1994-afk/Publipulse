import { z } from 'zod';
export const WeeklyReviewPrioritySchema = z.enum(['critical', 'high', 'routine']);
export const WeeklyReviewDistrictSchema = z.object({
    administrativeAreaCode: z.string().trim().min(1).max(120),
    signalCount: z.number().int().nonnegative(),
    verifiedCount: z.number().int().nonnegative(),
    ownedCount: z.number().int().nonnegative(),
    actedCount: z.number().int().nonnegative(),
    measuredCount: z.number().int().nonnegative(),
    durableCount: z.number().int().nonnegative(),
    unresolvedCount: z.number().int().nonnegative(),
    recurrenceCount: z.number().int().nonnegative(),
    blockerCount: z.number().int().nonnegative(),
    priority: WeeklyReviewPrioritySchema,
}).strict();
export const WeeklyReviewSummarySchema = z.object({
    weekStart: z.string().datetime({ offset: true }),
    weekEnd: z.string().datetime({ offset: true }),
    minCell: z.number().int().min(1).max(1000),
    districts: z.array(WeeklyReviewDistrictSchema),
    decisionsNeeded: z.array(z.enum(['unresolved_outcomes', 'persistent_recurrence', 'response_blockers', 'ownership_gaps'])),
    interpretation: z.string(),
}).strict();
export function classifyWeeklyReviewPriority(input) {
    if (input.recurrenceCount > 0 && input.unresolvedCount > 0)
        return 'critical';
    if (input.unresolvedCount > 0 || input.blockerCount > 0)
        return 'high';
    return 'routine';
}
export function buildWeeklyReviewSummary(weekStart, weekEnd, minCell, districts) {
    const safe = districts.map(d => ({ ...d, priority: classifyWeeklyReviewPriority(d) })).sort((a, b) => ({ critical: 0, high: 1, routine: 2 }[a.priority] - { critical: 0, high: 1, routine: 2 }[b.priority] || b.signalCount - a.signalCount || a.administrativeAreaCode.localeCompare(b.administrativeAreaCode)));
    const decisionsNeeded = [];
    if (safe.some(d => d.unresolvedCount > 0))
        decisionsNeeded.push('unresolved_outcomes');
    if (safe.some(d => d.recurrenceCount > 0))
        decisionsNeeded.push('persistent_recurrence');
    if (safe.some(d => d.blockerCount > 0))
        decisionsNeeded.push('response_blockers');
    if (safe.some(d => d.ownedCount < d.signalCount))
        decisionsNeeded.push('ownership_gaps');
    return { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), minCell, districts: safe, decisionsNeeded, interpretation: 'Weekly review is a descriptive operational prioritization aid. It does not establish outbreak status, clinical risk, causation, or intervention effectiveness. Suppressed cells are excluded from district-level reporting.' };
}
