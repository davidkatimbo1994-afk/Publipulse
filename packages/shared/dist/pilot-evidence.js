import { z } from 'zod';
const iso = z.string().datetime({ offset: true });
export const PilotEvidenceRecordInputSchema = z.object({
    label: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9 _.-]+$/),
    baselineStart: iso,
    baselineEnd: iso,
    pilotStart: iso,
    pilotEnd: iso,
    minCell: z.number().int().min(1).max(1000),
    weeklyDecisionChangeCount: z.number().int().min(0).max(100000),
    offlineSyncIncidentCount: z.number().int().min(0).max(100000),
    integrationIncidentCount: z.number().int().min(0).max(100000),
    privacyIncidentCount: z.number().int().min(0).max(100000),
    securityIncidentCount: z.number().int().min(0).max(100000),
    evidenceDigest: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/).optional()
}).superRefine((value, ctx) => {
    const b0 = Date.parse(value.baselineStart), b1 = Date.parse(value.baselineEnd), p0 = Date.parse(value.pilotStart), p1 = Date.parse(value.pilotEnd);
    if (!(b0 < b1))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baselineEnd'], message: 'baseline window must be ordered' });
    if (!(p0 < p1))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pilotEnd'], message: 'pilot window must be ordered' });
    if (b1 - b0 > 366 * 86400000 || p1 - p0 > 366 * 86400000)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pilotEnd'], message: 'window exceeds 366 days' });
});
