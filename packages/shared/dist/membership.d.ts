import { z } from 'zod';
export declare const MemberRoleSchema: z.ZodEnum<["owner", "administrator", "reviewer", "investigator", "responder", "analyst", "read_only", "auditor"]>;
/** Who is invited and for how long. The invitation carries no name, email or phone number. */
export declare const InvitationCreateSchema: z.ZodObject<{
    role: z.ZodEnum<["owner", "administrator", "reviewer", "investigator", "responder", "analyst", "read_only", "auditor"]>;
    expiresInDays: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    role: "owner" | "administrator" | "reviewer" | "investigator" | "responder" | "analyst" | "read_only" | "auditor";
    expiresInDays: number;
}, {
    role: "owner" | "administrator" | "reviewer" | "investigator" | "responder" | "analyst" | "read_only" | "auditor";
    expiresInDays?: number | undefined;
}>;
export type InvitationCreate = z.infer<typeof InvitationCreateSchema>;
export declare const InvitationRedeemSchema: z.ZodObject<{
    code: z.ZodString;
}, "strict", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export type InvitationRedeem = z.infer<typeof InvitationRedeemSchema>;
export declare const MemberChangeSchema: z.ZodEffects<z.ZodObject<{
    role: z.ZodOptional<z.ZodEnum<["owner", "administrator", "reviewer", "investigator", "responder", "analyst", "read_only", "auditor"]>>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    active?: boolean | undefined;
    role?: "owner" | "administrator" | "reviewer" | "investigator" | "responder" | "analyst" | "read_only" | "auditor" | undefined;
}, {
    active?: boolean | undefined;
    role?: "owner" | "administrator" | "reviewer" | "investigator" | "responder" | "analyst" | "read_only" | "auditor" | undefined;
}>, {
    active?: boolean | undefined;
    role?: "owner" | "administrator" | "reviewer" | "investigator" | "responder" | "analyst" | "read_only" | "auditor" | undefined;
}, {
    active?: boolean | undefined;
    role?: "owner" | "administrator" | "reviewer" | "investigator" | "responder" | "analyst" | "read_only" | "auditor" | undefined;
}>;
export type MemberChange = z.infer<typeof MemberChangeSchema>;
export declare const OrganizationProvisionSchema: z.ZodObject<{
    name: z.ZodString;
    countryCode: z.ZodString;
    ownerUserId: z.ZodOptional<z.ZodString>;
    invitationDays: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    name: string;
    countryCode: string;
    invitationDays: number;
    ownerUserId?: string | undefined;
}, {
    name: string;
    countryCode: string;
    ownerUserId?: string | undefined;
    invitationDays?: number | undefined;
}>;
export type OrganizationProvision = z.infer<typeof OrganizationProvisionSchema>;
