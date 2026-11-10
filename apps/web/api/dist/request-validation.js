/**
 * Parse bounded decimal query limits without JavaScript's permissive Number()
 * coercion (hex, exponent notation, whitespace and array coercion).
 */
export function parseQueryLimit(value, defaultValue = 25, max = 100) {
    if (value === undefined)
        return defaultValue;
    if (typeof value !== 'string')
        return null;
    const maxDigits = String(max).length;
    const pattern = new RegExp(`^(?:[1-9][0-9]{0,${Math.max(0, maxDigits - 1)}})$`);
    if (!pattern.test(value))
        return null;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max)
        return null;
    return parsed;
}
