/**
 * The USSD and SMS conversation for community reports. Pure functions, no imports, so they can be tested directly.
 * Nothing here knows about phone numbers: the caller never passes one in.
 *  - USSD is stateless: the gateway sends everything typed so far, joined with "*", so each request is re-read from the start.
 *  - SMS has no session, so the single message "REPORT <category> <area> [URGENT] [note]" is the agreement and the report in one act.
 *    Nothing is kept from a message that is not a complete, agreed report (ADR-007).
 */
export declare const CONSENT_VERSION = "v1";
export declare const NOTE_MAX_LENGTH = 160;
export declare const USSD_SCREEN_MAX = 160;
export declare const COMMUNITY_CATEGORIES: readonly [{
    readonly digit: "1";
    readonly key: "unusual_illness";
    readonly label: "Unusual illness/deaths";
}, {
    readonly digit: "2";
    readonly key: "water_sanitation";
    readonly label: "Water/sanitation";
}, {
    readonly digit: "3";
    readonly key: "supply_gap";
    readonly label: "Medicine/supplies";
}, {
    readonly digit: "4";
    readonly key: "animal_health";
    readonly label: "Sick animals";
}, {
    readonly digit: "5";
    readonly key: "other";
    readonly label: "Other";
}];
export type CommunityCategoryKey = (typeof COMMUNITY_CATEGORIES)[number]['key'];
export interface CommunityArea {
    code: string;
    label: string;
}
export interface CommunityMessages {
    consent: string;
    categoryHeader: string;
    areaHeader: string;
    urgent: string;
    thanks: string;
    stopped: string;
    invalid: string;
    smsHelp: string;
    smsNoteTooLong: string;
    smsStopped: string;
}
export declare const DEFAULT_MESSAGES: CommunityMessages;
export interface CommunityFlowConfig {
    areas: ReadonlyArray<CommunityArea>;
    messages?: Partial<CommunityMessages>;
}
export interface CommunitySubmissionInput {
    channel: 'ussd' | 'sms';
    category: CommunityCategoryKey;
    areaCode: string;
    urgent: boolean;
    narrative: string | null;
    consentVersion: string;
}
export type FlowOutcome = {
    kind: 'reply';
    end: boolean;
    reply: string;
} | {
    kind: 'submit';
    submission: CommunitySubmissionInput;
    reply: string;
};
export declare function categoryMenu(c: CommunityFlowConfig): string;
export declare function areaMenu(c: CommunityFlowConfig): string;
/** Problems that would make the service unusable or unsafe. An empty list means the configuration is acceptable. */
export declare function validateFlowConfig(c: CommunityFlowConfig): string[];
/** `text` is what the gateway sends: every choice so far, joined with "*" (empty on the first request). */
export declare function handleUssd(text: string, c: CommunityFlowConfig): FlowOutcome;
export declare function smsHelp(c: CommunityFlowConfig): string;
export declare function handleSms(rawText: string, c: CommunityFlowConfig): FlowOutcome;
