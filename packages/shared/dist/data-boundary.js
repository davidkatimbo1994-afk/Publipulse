import { z } from 'zod';
/**
 * Public-health intake boundary. PubliPulse is not a patient-identification store.
 * This guard catches common direct contact/identifier patterns accidentally pasted
 * into narrative fields. It is intentionally conservative and is not a DLP engine.
 */
const DIRECT_IDENTIFIER_PATTERNS = [
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, 'email_address'],
    [/(?<!\d)(?:\+?\d[\d .()\-]{7,}\d)(?!\d)/, 'phone_number'],
    [/\b(?:patient|client|person)\s*(?:id|identifier|number)\s*[:#-]?\s*[A-Z0-9-]{4,}\b/i, 'direct_identifier_label'],
];
export function findDirectIdentifierPattern(value) {
    for (const [pattern, code] of DIRECT_IDENTIFIER_PATTERNS) {
        if (pattern.test(value))
            return code;
    }
    return null;
}
export function publicHealthNarrative(schema) {
    return schema.superRefine((value, ctx) => {
        if (typeof value !== 'string')
            return;
        const code = findDirectIdentifierPattern(value);
        if (code)
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `direct_identifier_not_allowed:${code}` });
    });
}
export function assertPublicHealthNarrative(value) {
    const code = findDirectIdentifierPattern(value);
    if (code)
        throw new Error(`direct_identifier_not_allowed:${code}`);
}
