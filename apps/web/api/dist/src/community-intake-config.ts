import { DEFAULT_COMMUNITY_LIMITS, validateFlowConfig } from '@publipulse/shared';
import type { CommunityArea, CommunityLimits, CommunityMessages } from '@publipulse/shared';

export interface IntakeChannelConfig {
  organizationId: string; ussdServiceCode?: string; smsShortCode?: string; areas: CommunityArea[]; messages?: Partial<CommunityMessages>;
}
export interface CommunityIntakeConfig { channels: IntakeChannelConfig[]; pepper: string; webhookSecret: string; limits: CommunityLimits; allowedIps: string[]; gatewayRateLimitPerMinute: number }
export type LoadResult =
  | { status: 'not_configured' }
  | { status: 'invalid'; problems: string[] }
  | { status: 'ready'; config: CommunityIntakeConfig };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const normalizeServiceCode = (v: string): string => v.replace(/\s+/g, '');

/**
 * Reads the gateway wiring from the environment. Nothing set means the feature is off (routes answer 503). Anything set but
 * incomplete or unsafe is reported, so a half-configured service fails at start-up instead of running open.
 *   COMMUNITY_INTAKE_CHANNELS          JSON array: [{organizationId, ussdServiceCode?, smsShortCode?, areas:[{code,label}], messages?}]
 *   COMMUNITY_INTAKE_PEPPER            at least 32 characters; keys the sender hash. Rotating it restarts all limits.
 *   COMMUNITY_INTAKE_WEBHOOK_SECRET    at least 24 characters; the gateway sends it in the x-intake-secret header.
 *   COMMUNITY_INTAKE_ALLOWED_IPS       optional, comma-separated; only meaningful if the API sees the gateway's real address.
 *   COMMUNITY_INTAKE_LIMITS            optional JSON overriding the ADR-008 starting limits.
 *   COMMUNITY_INTAKE_GATEWAY_RATE      optional requests per minute for the gateway routes (default 1200).
 */
export function loadCommunityIntakeConfig(env: Record<string, string | undefined>): LoadResult {
  const raw = env.COMMUNITY_INTAKE_CHANNELS; const pepper = env.COMMUNITY_INTAKE_PEPPER; const secret = env.COMMUNITY_INTAKE_WEBHOOK_SECRET;
  if (!raw && !pepper && !secret) return { status: 'not_configured' };
  const problems: string[] = [];
  if (!pepper || pepper.length < 32) problems.push('COMMUNITY_INTAKE_PEPPER must be at least 32 characters');
  if (!secret || secret.length < 24) problems.push('COMMUNITY_INTAKE_WEBHOOK_SECRET must be at least 24 characters');
  let channels: IntakeChannelConfig[] = [];
  try {
    const parsed: unknown = JSON.parse(raw ?? '');
    if (!Array.isArray(parsed) || parsed.length === 0) problems.push('COMMUNITY_INTAKE_CHANNELS must be a non-empty JSON array');
    else channels = parsed as IntakeChannelConfig[];
  } catch { problems.push('COMMUNITY_INTAKE_CHANNELS is missing or not valid JSON'); }
  const seen = new Set<string>();
  channels.forEach((c, i) => {
    const at = `channel ${i + 1}`;
    if (typeof c !== 'object' || c === null || !UUID.test(String(c.organizationId))) { problems.push(`${at}: organizationId must be a UUID`); return; }
    if (!c.ussdServiceCode && !c.smsShortCode) problems.push(`${at}: needs ussdServiceCode or smsShortCode`);
    for (const code of [c.ussdServiceCode, c.smsShortCode]) {
      if (code === undefined) continue;
      const n = normalizeServiceCode(String(code));
      if (n === '' || n.length > 30) problems.push(`${at}: service code is empty or too long`);
      if (seen.has(n)) problems.push(`${at}: service code ${n} is used twice`);
      seen.add(n);
    }
    if (!Array.isArray(c.areas)) { problems.push(`${at}: areas must be an array`); return; }
    for (const p of validateFlowConfig({ areas: c.areas, ...(c.messages ? { messages: c.messages } : {}) })) problems.push(`${at}: ${p}`);
  });
  let limits: CommunityLimits = { ...DEFAULT_COMMUNITY_LIMITS };
  if (env.COMMUNITY_INTAKE_LIMITS) {
    try {
      const o = JSON.parse(env.COMMUNITY_INTAKE_LIMITS) as Partial<CommunityLimits>;
      limits = { ...limits, ...o };
      for (const [k, v] of Object.entries(limits)) if (!Number.isInteger(v) || v < 1 || v > 100_000) problems.push(`COMMUNITY_INTAKE_LIMITS.${k} must be a whole number from 1 to 100000`);
    } catch { problems.push('COMMUNITY_INTAKE_LIMITS is not valid JSON'); }
  }
  const rate = env.COMMUNITY_INTAKE_GATEWAY_RATE ? Number(env.COMMUNITY_INTAKE_GATEWAY_RATE) : 1200;
  if (!Number.isInteger(rate) || rate < 10 || rate > 100_000) problems.push('COMMUNITY_INTAKE_GATEWAY_RATE must be a whole number from 10 to 100000');
  if (problems.length > 0) return { status: 'invalid', problems };
  const allowedIps = (env.COMMUNITY_INTAKE_ALLOWED_IPS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return { status: 'ready', config: { channels, pepper: pepper!, webhookSecret: secret!, limits, allowedIps, gatewayRateLimitPerMinute: rate } };
}
