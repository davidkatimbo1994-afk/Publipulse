/**
 * Africa's Talking webhook shapes (ADR-006's first reference adapter). Everything else about the gateway stays out of core code.
 *   USSD callback body:  sessionId, serviceCode, phoneNumber, text, networkCode
 *   SMS callback body:   id, from, to, text, date, linkId
 * Both arrive form-encoded. The adapter only checks shape and size; the fields are not trusted further.
 */
const field = (body, key, max) => {
    if (typeof body !== 'object' || body === null)
        return null;
    const v = body[key];
    return typeof v === 'string' && v.length <= max ? v : null;
};
export function parseUssdCallback(body) {
    const serviceCode = field(body, 'serviceCode', 40);
    const phone = field(body, 'phoneNumber', 40);
    // Some gateways leave `text` out on the very first dial. That is the same as an empty string, not a bad request.
    const hasText = typeof body === 'object' && body !== null && 'text' in body;
    const text = hasText ? field(body, 'text', 200) : '';
    return serviceCode !== null && phone !== null && text !== null ? { channel: 'ussd', destination: serviceCode, sender: phone, text } : null;
}
export function parseSmsCallback(body) {
    const to = field(body, 'to', 40);
    const from = field(body, 'from', 40);
    const text = field(body, 'text', 1000);
    return to !== null && from !== null && text !== null ? { channel: 'sms', destination: to, sender: from, text } : null;
}
/** USSD answers are plain text that starts with CON (more input expected) or END (session over). */
export const formatUssdReply = (reply, end) => `${end ? 'END' : 'CON'} ${reply}`;
