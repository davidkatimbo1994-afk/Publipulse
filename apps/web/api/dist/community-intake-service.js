import { createHmac } from 'node:crypto';
import { findDirectIdentifierPattern, handleSms, handleUssd } from '@publipulse/shared';
import { normalizeServiceCode } from './community-intake-config.js';
export const LIMITED_REPLY = 'Message not accepted. Please try again later.';
export const IDENTIFIER_REPLY = 'Message not accepted. Please send no names, phone numbers or ID numbers.';
export const UNKNOWN_REPLY = 'This service is not available.';
const hmac = (pepper, value) => createHmac('sha256', pepper).update(value, 'utf8').digest('hex');
export function createCommunityIntakeService(deps) {
    const now = deps.now ?? (() => new Date());
    const byCode = new Map();
    for (const c of deps.config.channels) {
        if (c.ussdServiceCode)
            byCode.set(`ussd:${normalizeServiceCode(c.ussdServiceCode)}`, c);
        if (c.smsShortCode)
            byCode.set(`sms:${normalizeServiceCode(c.smsShortCode)}`, c);
    }
    return {
        async handle(msg) {
            const channel = byCode.get(`${msg.channel}:${normalizeServiceCode(msg.destination)}`);
            if (!channel)
                return { reply: UNKNOWN_REPLY, end: true, outcome: 'unknown_destination' };
            const flowConfig = { areas: channel.areas, ...(channel.messages ? { messages: channel.messages } : {}) };
            const step = msg.channel === 'ussd' ? handleUssd(msg.text, flowConfig) : handleSms(msg.text, flowConfig);
            if (step.kind === 'reply')
                return { reply: step.reply, end: step.end, outcome: 'prompt' };
            // A complete, agreed report. Only now is the sender's number used, and only to make keyed hashes.
            // Digits only, so "+254 700 111 222" and "254700111222" are the same person to the limits. A local format that drops the
            // country code cannot be reconciled here; gateways send one consistent format per sender.
            const number = msg.sender.replace(/\D/g, '');
            if (number.length < 6 || number.length > 20)
                return { reply: LIMITED_REPLY, end: true, outcome: 'unusable_sender' };
            const orgId = channel.organizationId;
            const senderHash = hmac(deps.config.pepper, `${orgId}|sender|${number}`);
            const s = step.submission;
            if (s.narrative !== null && findDirectIdentifierPattern(s.narrative) !== null) {
                // Refused and not stored. The refusal still counts toward the sender's cooldown.
                await deps.store.reject(orgId, senderHash, now(), deps.config.limits);
                return { reply: IDENTIFIER_REPLY, end: true, outcome: 'refused_identifier' };
            }
            const duplicateHash = hmac(deps.config.pepper, `${orgId}|dup|${number}|${s.channel}|${s.category}|${s.areaCode}|${s.urgent ? 1 : 0}|${s.narrative ?? ''}`);
            const result = await deps.store.receive(orgId, { senderHash, duplicateHash, submission: s }, now(), deps.config.limits);
            // A repeat of the same report is told "thank you": it was received earlier, and this also makes gateway retries harmless.
            if (result.kind === 'accepted')
                return { reply: step.reply, end: true, outcome: 'accepted' };
            if (result.kind === 'duplicate')
                return { reply: step.reply, end: true, outcome: 'duplicate' };
            // Which limit was hit is deliberately not revealed.
            return { reply: LIMITED_REPLY, end: true, outcome: 'limited' };
        }
    };
}
