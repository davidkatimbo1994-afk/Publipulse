import { z } from 'zod';
import { INVITATION_CODE_PATTERN, INVITATION_DEFAULT_DAYS, INVITATION_MAX_DAYS, MEMBER_ROLES } from './membership-rules.js';
export const MemberRoleSchema = z.enum(MEMBER_ROLES);
/** Who is invited and for how long. The invitation carries no name, email or phone number. */
export const InvitationCreateSchema = z.object({
    role: MemberRoleSchema,
    expiresInDays: z.number().int().min(1).max(INVITATION_MAX_DAYS).default(INVITATION_DEFAULT_DAYS)
}).strict();
export const InvitationRedeemSchema = z.object({ code: z.string().regex(INVITATION_CODE_PATTERN) }).strict();
export const MemberChangeSchema = z.object({ role: MemberRoleSchema.optional(), active: z.boolean().optional() }).strict()
    .refine((v) => v.role !== undefined || v.active !== undefined, 'at least one of role or active is required');
export const OrganizationProvisionSchema = z.object({
    name: z.string().trim().min(2).max(160),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    ownerUserId: z.string().uuid().optional(),
    invitationDays: z.number().int().min(1).max(INVITATION_MAX_DAYS).default(INVITATION_DEFAULT_DAYS)
}).strict();
