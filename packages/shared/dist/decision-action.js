import { z } from 'zod';
import { publicHealthNarrative } from './data-boundary.js';
export const DecisionIntakeSchema = z.object({
    investigationId: z.string().uuid().optional(),
    decision: z.enum(['continue_review', 'verify', 'escalate', 'dismiss', 'close']),
    rationale: publicHealthNarrative(z.string().trim().min(5).max(4000)),
    evidenceSummary: publicHealthNarrative(z.string().trim().max(4000)).optional()
}).strict();
export const ResponseActionIntakeSchema = z.object({
    decisionId: z.string().uuid().optional(),
    title: z.string().trim().min(3).max(200),
    description: publicHealthNarrative(z.string().trim().max(4000)).optional(),
    ownerUserId: z.string().uuid(),
    dueAt: z.string().datetime({ offset: true }).optional()
}).strict();
export const ResponseActionUpdateSchema = z.object({
    expectedVersion: z.number().int().min(1).max(2147483647),
    status: z.enum(['open', 'in_progress', 'blocked', 'completed', 'cancelled']).optional(),
    dueAt: z.string().datetime({ offset: true }).nullable().optional(),
    completionEvidence: publicHealthNarrative(z.string().trim().max(4000)).nullable().optional()
}).strict().refine(v => v.status !== undefined || v.dueAt !== undefined || v.completionEvidence !== undefined, 'at least one update field is required')
    .refine(v => v.status !== 'completed' || (v.completionEvidence !== undefined && v.completionEvidence !== null && v.completionEvidence.trim().length >= 3), 'completion evidence is required to complete an action');
