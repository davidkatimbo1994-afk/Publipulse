/**
 * The USSD and SMS conversation for community reports. Pure functions, no imports, so they can be tested directly.
 * Nothing here knows about phone numbers: the caller never passes one in.
 *  - USSD is stateless: the gateway sends everything typed so far, joined with "*", so each request is re-read from the start.
 *  - SMS has no session, so the single message "REPORT <category> <area> [URGENT] [note]" is the agreement and the report in one act.
 *    Nothing is kept from a message that is not a complete, agreed report (ADR-007).
 */
export const CONSENT_VERSION = 'v1';
export const NOTE_MAX_LENGTH = 160;
export const USSD_SCREEN_MAX = 160;
export const COMMUNITY_CATEGORIES = [
    { digit: '1', key: 'unusual_illness', label: 'Unusual illness/deaths' },
    { digit: '2', key: 'water_sanitation', label: 'Water/sanitation' },
    { digit: '3', key: 'supply_gap', label: 'Medicine/supplies' },
    { digit: '4', key: 'animal_health', label: 'Sick animals' },
    { digit: '5', key: 'other', label: 'Other' }
];
export const DEFAULT_MESSAGES = {
    consent: 'PubliPulse health report. We keep your report, not your number.\n1 Agree and continue\n2 Stop',
    categoryHeader: 'What happened?',
    areaHeader: 'Where?',
    urgent: 'Are several people sick?\n1 Yes\n2 No',
    thanks: 'Thank you. Your report was sent to the district team.',
    stopped: 'Stopped. Nothing was saved.',
    invalid: 'Not understood. Please dial again.',
    smsHelp: 'PubliPulse health report. We keep the report, not your number. To send, reply: REPORT <type 1-5> <area> [URGENT] [short note]. Types: 1 illness/deaths 2 water 3 supplies 4 animals 5 other. Sending REPORT means you agree. STOP to opt out.',
    smsNoteTooLong: `Note too long (max ${NOTE_MAX_LENGTH} characters). Nothing was saved.`,
    smsStopped: 'You will get no more messages. Nothing was saved.'
};
const msgs = (c) => ({ ...DEFAULT_MESSAGES, ...(c.messages ?? {}) });
const AREA_CODE = /^[A-Za-z0-9._-]{1,80}$/;
export function categoryMenu(c) {
    return `${msgs(c).categoryHeader}\n${COMMUNITY_CATEGORIES.map((x) => `${x.digit} ${x.label}`).join('\n')}`;
}
export function areaMenu(c) {
    return `${msgs(c).areaHeader}\n${c.areas.map((a, i) => `${i + 1} ${a.label}`).join('\n')}`;
}
/** Problems that would make the service unusable or unsafe. An empty list means the configuration is acceptable. */
export function validateFlowConfig(c) {
    const problems = [];
    if (c.areas.length < 1 || c.areas.length > 9)
        problems.push('between 1 and 9 areas are needed (a USSD menu has single-digit choices)');
    const seen = new Set();
    for (const a of c.areas) {
        if (!AREA_CODE.test(a.code))
            problems.push(`area code "${a.code}" is not allowed`);
        if (seen.has(a.code))
            problems.push(`area code "${a.code}" is repeated`);
        seen.add(a.code);
        if (a.label.trim() === '' || /[*#\n]/.test(a.label))
            problems.push(`area label for "${a.code}" is empty or contains *, # or a line break`);
    }
    const screens = [['consent', msgs(c).consent], ['category menu', categoryMenu(c)], ['area menu', areaMenu(c)], ['urgent question', msgs(c).urgent], ['thanks', msgs(c).thanks]];
    for (const [name, text] of screens)
        if (text.length > USSD_SCREEN_MAX)
            problems.push(`the ${name} screen is ${text.length} characters; the limit used here is ${USSD_SCREEN_MAX}`);
    return problems;
}
const invalid = (c) => ({ kind: 'reply', end: true, reply: msgs(c).invalid });
/** `text` is what the gateway sends: every choice so far, joined with "*" (empty on the first request). */
export function handleUssd(text, c) {
    if (text.length > 40 || !/^[0-9*]*$/.test(text))
        return invalid(c);
    const steps = text === '' ? [] : text.split('*');
    const m = msgs(c);
    if (steps.length === 0)
        return { kind: 'reply', end: false, reply: m.consent };
    if (steps[0] === '2')
        return { kind: 'reply', end: true, reply: m.stopped };
    if (steps[0] !== '1')
        return invalid(c);
    if (steps.length === 1)
        return { kind: 'reply', end: false, reply: categoryMenu(c) };
    const category = COMMUNITY_CATEGORIES.find((x) => x.digit === steps[1]);
    if (!category)
        return invalid(c);
    if (steps.length === 2)
        return { kind: 'reply', end: false, reply: areaMenu(c) };
    const areaIndex = /^[1-9]$/.test(steps[2] ?? '') ? Number(steps[2]) - 1 : -1;
    const area = c.areas[areaIndex];
    if (!area)
        return invalid(c);
    if (steps.length === 3)
        return { kind: 'reply', end: false, reply: m.urgent };
    if ((steps[3] !== '1' && steps[3] !== '2') || steps.length > 4)
        return invalid(c);
    return {
        kind: 'submit', reply: m.thanks,
        submission: { channel: 'ussd', category: category.key, areaCode: area.code, urgent: steps[3] === '1', narrative: null, consentVersion: CONSENT_VERSION }
    };
}
export function smsHelp(c) {
    return `${msgs(c).smsHelp} Areas: ${c.areas.map((a, i) => `${i + 1} ${a.label}`).join(', ')}.`;
}
const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END']);
export function handleSms(rawText, c) {
    // eslint-disable-next-line no-control-regex
    const text = rawText.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = text.split(' ');
    const first = (tokens[0] ?? '').toUpperCase();
    const m = msgs(c);
    if (STOP_WORDS.has(first))
        return { kind: 'reply', end: true, reply: m.smsStopped };
    if (first !== 'REPORT')
        return { kind: 'reply', end: true, reply: smsHelp(c) };
    const category = COMMUNITY_CATEGORIES.find((x) => x.digit === tokens[1]);
    const areaIndex = /^[1-9]$/.test(tokens[2] ?? '') ? Number(tokens[2]) - 1 : -1;
    const area = c.areas[areaIndex];
    if (!category || !area)
        return { kind: 'reply', end: true, reply: smsHelp(c) };
    let rest = tokens.slice(3);
    const urgent = (rest[0] ?? '').toUpperCase() === 'URGENT';
    if (urgent)
        rest = rest.slice(1);
    const note = rest.join(' ');
    if (note.length > NOTE_MAX_LENGTH)
        return { kind: 'reply', end: true, reply: m.smsNoteTooLong };
    return {
        kind: 'submit', reply: m.thanks,
        submission: { channel: 'sms', category: category.key, areaCode: area.code, urgent, narrative: note === '' ? null : note, consentVersion: CONSENT_VERSION }
    };
}
