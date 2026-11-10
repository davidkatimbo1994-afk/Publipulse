/**
 * In-memory API client helpers for the web command center.
 * Access tokens are held in memory only and never written to any browser storage.
 */
import type { ApiRecord, ConnectedWorkflow } from './types';
import { text } from './format';

import { type ApiConfig, isConfigReady } from './api-config';
export { type ApiConfig, isConfigReady, isHttpBaseUrl } from './api-config';

function headers(cfg: ApiConfig, extra?: Record<string, string>): HeadersInit {
  return {
    Authorization: `Bearer ${cfg.accessToken.trim()}`,
    'x-organization-id': cfg.organizationId.trim(),
    ...extra
  };
}

function base(cfg: ApiConfig): string {
  return cfg.baseUrl.trim().replace(/\/$/, '');
}

async function getJson(cfg: ApiConfig, path: string): Promise<ApiRecord> {
  const response = await fetch(`${base(cfg)}${path}`, { headers: headers(cfg) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(body.error, `Request failed (${response.status})`));
  return body as ApiRecord;
}

export async function loadConnectedWorkflow(cfg: ApiConfig): Promise<{
  connected: ConnectedWorkflow;
  notice: string;
}> {
  if (!isConfigReady(cfg)) {
    throw new Error('Provide API base URL, organization ID, and access token (held in memory only).');
  }
  if (!cfg.signalId.trim()) {
    throw new Error('Provide a signal ID to load the connected workflow.');
  }

  const id = encodeURIComponent(cfg.signalId.trim());
  const [signals, evidence, investigations, decisions, actions, outcomes, gaps] = await Promise.all([
    getJson(cfg, '/v1/signals?limit=100'),
    getJson(cfg, `/v1/signals/${id}/evidence?limit=100`),
    getJson(cfg, `/v1/signals/${id}/investigations?limit=100`),
    getJson(cfg, `/v1/signals/${id}/decisions?limit=100`),
    getJson(cfg, `/v1/signals/${id}/actions?limit=100`),
    getJson(cfg, `/v1/signals/${id}/outcomes?limit=100`),
    getJson(cfg, '/v1/action-gaps?limit=100')
  ]);

  const signalRows = Array.isArray(signals.signals) ? (signals.signals as ApiRecord[]) : [];
  const signal = signalRows.find((row) => row.id === cfg.signalId.trim()) ?? null;
  const actionRows = Array.isArray(actions.actions) ? (actions.actions as ApiRecord[]) : [];

  let handoffs: ApiRecord[] = [];
  if (cfg.actionId.trim()) {
    const handoffAction = actionRows.find((row) => row.id === cfg.actionId.trim());
    if (handoffAction) {
      const h = await getJson(cfg, `/v1/actions/${encodeURIComponent(cfg.actionId.trim())}/handoffs?limit=100`);
      handoffs = Array.isArray(h.events) ? (h.events as ApiRecord[]) : [];
    }
  }

  const gapRows = Array.isArray(gaps.detections) ? (gaps.detections as ApiRecord[]) : [];
  const outcomeRows = Array.isArray(outcomes.outcomes) ? (outcomes.outcomes as ApiRecord[]) : [];

  const connected: ConnectedWorkflow = {
    signal,
    evidence: Array.isArray(evidence.evidence) ? (evidence.evidence as ApiRecord[]) : [],
    investigations: Array.isArray(investigations.investigations)
      ? (investigations.investigations as ApiRecord[])
      : [],
    decisions: Array.isArray(decisions.decisions) ? (decisions.decisions as ApiRecord[]) : [],
    actions: actionRows,
    outcomes: outcomeRows,
    handoffs,
    gaps: gapRows.filter((g) => g.signalId === cfg.signalId.trim())
  };

  return {
    connected,
    notice: `Connected workflow loaded: ${signal ? 'signal found' : 'signal not found in the organization'}, ${actionRows.length} action(s), ${outcomeRows.length} outcome assessment(s).`
  };
}

export async function loadWeeklyReview(cfg: ApiConfig): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization first.');
  const body = await getJson(cfg, '/v1/learning/weekly-review?days=7');
  // The API returns the review under `summary`; `review` is kept for older servers.
  return (body.summary as ApiRecord) ?? (body.review as ApiRecord) ?? body;
}

export async function loadLearningSummary(cfg: ApiConfig): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization first.');
  const body = await getJson(cfg, '/v1/learning/summary?days=90');
  return (body.summary as ApiRecord) ?? body;
}

export async function loadSevenOneSeven(cfg: ApiConfig): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization first.');
  const body = await getJson(cfg, '/v1/learning/7-1-7?days=90&minCell=5');
  return (body.summary as ApiRecord) ?? body;
}


export type SignalIntakeBody = {
  clientSubmissionId: string;
  category: string;
  summary: string;
  observedAt: string;
  location: { administrativeAreaCode: string; precision: string };
  sourceType: string;
};

/** POST /v1/signals — shared SignalIntake shape. Token stays in memory. */
export async function submitSignal(cfg: ApiConfig, body: SignalIntakeBody): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) {
    throw new Error('Connect an authorized organization before submitting online.');
  }
  const response = await fetch(`${base(cfg)}/v1/signals`, {
    method: 'POST',
    headers: headers(cfg, { 'content-type': 'application/json' }),
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(data.error, `Signal submission failed (${response.status})`));
  return data as ApiRecord;
}

export type ActionCostBody = {
  costKind: 'planned' | 'actual';
  costCategory: string;
  amount: number;
  currencyCode: string;
  incurredOn: string;
  note?: string;
};

/** GET /v1/actions/:actionId/costs — entries plus totals per currency and planned/actual. */
export async function loadActionCosts(cfg: ApiConfig, actionId: string): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization before loading costs.');
  return getJson(cfg, `/v1/actions/${encodeURIComponent(actionId)}/costs?limit=100`);
}

/** POST /v1/actions/:actionId/costs — append-only; send a stable client mutation id (UUID) so retries are safe. */
export async function recordActionCost(cfg: ApiConfig, actionId: string, body: ActionCostBody, clientMutationId: string): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization before recording costs.');
  const response = await fetch(`${base(cfg)}/v1/actions/${encodeURIComponent(actionId)}/costs`, {
    method: 'POST',
    headers: headers(cfg, { 'content-type': 'application/json', 'x-client-mutation-id': clientMutationId }),
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(data.error, `Cost entry failed (${response.status})`));
  return data as ApiRecord;
}

/** GET /v1/costs/summary — per action: cost totals, outcome assessment counts and actual cost per improved assessment. */
export async function loadCostSummary(cfg: ApiConfig): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization before loading cost summaries.');
  return getJson(cfg, '/v1/costs/summary?limit=100');
}

export type StockSnapshotBody = {
  administrativeAreaCode: string;
  commodityCode: string;
  unit: string;
  quantityOnHand: number;
  quantityReceived?: number;
  observedAt: string;
};

/** GET /v1/stock/forecast — per area/commodity: consumption, days of stock left, alert level and a draft signal (never auto-submitted). */
export async function loadStockForecast(cfg: ApiConfig, leadTimeDays = 7): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization before loading stock forecasts.');
  return getJson(cfg, `/v1/stock/forecast?limit=100&leadTimeDays=${encodeURIComponent(String(leadTimeDays))}`);
}

/** POST /v1/stock/snapshots — append-only; send a stable client mutation id (UUID) so retries are safe. */
export async function recordStockSnapshot(cfg: ApiConfig, body: StockSnapshotBody, clientMutationId: string): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization before recording stock.');
  const response = await fetch(`${base(cfg)}/v1/stock/snapshots`, {
    method: 'POST',
    headers: headers(cfg, { 'content-type': 'application/json', 'x-client-mutation-id': clientMutationId }),
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(data.error, `Stock snapshot failed (${response.status})`));
  return data as ApiRecord;
}

export type ContextObservationBody = {
  administrativeAreaCode: string;
  metricCode: string;
  value: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  sourceLabel: string;
  sourceUri?: string;
};

/** GET /v1/signals/:signalId/context — context around the signal's area and time, compared with earlier periods. Association only, never cause. */
export async function loadSignalContext(cfg: ApiConfig, signalId: string): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization before loading context.');
  return getJson(cfg, `/v1/signals/${encodeURIComponent(signalId)}/context`);
}

/** POST /v1/context/observations — append-only; send a stable client mutation id (UUID) so retries are safe. */
export async function recordContextObservation(cfg: ApiConfig, body: ContextObservationBody, clientMutationId: string): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization before recording context.');
  const response = await fetch(`${base(cfg)}/v1/context/observations`, {
    method: 'POST',
    headers: headers(cfg, { 'content-type': 'application/json', 'x-client-mutation-id': clientMutationId }),
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(data.error, `Context observation failed (${response.status})`));
  return data as ApiRecord;
}

/** GET /v1/context/observations — recent area-level observations, optionally filtered by area and metric. */
export async function listContextObservations(cfg: ApiConfig, filter: { areaCode?: string; metricCode?: string } = {}): Promise<ApiRecord> {
  if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization before loading context.');
  const q = new URLSearchParams({ limit: '100' });
  if (filter.areaCode) q.set('areaCode', filter.areaCode);
  if (filter.metricCode) q.set('metricCode', filter.metricCode);
  return getJson(cfg, `/v1/context/observations?${q.toString()}`);
}

async function sendJson(cfg: ApiConfig, method: 'POST' | 'PATCH', path: string, body: unknown): Promise<ApiRecord> {
  const response = await fetch(`${base(cfg)}${path}`, { method, headers: headers(cfg, { 'content-type': 'application/json' }), body: JSON.stringify(body) });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(parsed.error, `Request failed (${response.status})`));
  return parsed as ApiRecord;
}
const needReady = (cfg: ApiConfig) => { if (!isConfigReady(cfg)) throw new Error('Connect an authorized organization first.'); };

/** GET /v1/members and /v1/invitations — owners and administrators only (the server decides). */
export async function loadMembers(cfg: ApiConfig): Promise<ApiRecord> { needReady(cfg); return getJson(cfg, '/v1/members?limit=100'); }
export async function loadInvitations(cfg: ApiConfig): Promise<ApiRecord> { needReady(cfg); return getJson(cfg, '/v1/invitations?limit=100'); }
export async function changeMember(cfg: ApiConfig, userId: string, change: { role?: string; active?: boolean }): Promise<ApiRecord> {
  needReady(cfg); return sendJson(cfg, 'PATCH', `/v1/members/${encodeURIComponent(userId)}`, change);
}
export async function createInvitation(cfg: ApiConfig, role: string, expiresInDays: number): Promise<ApiRecord> {
  needReady(cfg); return sendJson(cfg, 'POST', '/v1/invitations', { role, expiresInDays });
}
export async function revokeInvitation(cfg: ApiConfig, invitationId: string): Promise<ApiRecord> {
  needReady(cfg); return sendJson(cfg, 'POST', `/v1/invitations/${encodeURIComponent(invitationId)}/revoke`, {});
}
/** POST /v1/invitations/redeem — works before the person is a member; needs only a valid sign-in and the organisation id. */
export async function redeemInvitation(cfg: ApiConfig, code: string): Promise<ApiRecord> {
  needReady(cfg); return sendJson(cfg, 'POST', '/v1/invitations/redeem', { code });
}

/** Community USSD/SMS reports waiting for a human decision (reviewer, administrator or owner). */
export async function loadCommunityQueue(cfg: ApiConfig, status: 'pending' | 'reviewed' | 'all' = 'pending'): Promise<ApiRecord> {
  needReady(cfg); return getJson(cfg, `/v1/community-intake/queue?status=${status}&limit=100`);
}
export async function loadCommunityStats(cfg: ApiConfig): Promise<ApiRecord> { needReady(cfg); return getJson(cfg, '/v1/community-intake/stats'); }
export type CommunityReviewBody =
  | { decision: 'promote'; summary?: string; category?: string; precision?: 'community' | 'district' }
  | { decision: 'merge'; signalId: string; reason?: string }
  | { decision: 'dismiss'; reason: string };
export async function reviewCommunitySubmission(cfg: ApiConfig, id: string, body: CommunityReviewBody): Promise<ApiRecord> {
  needReady(cfg); return sendJson(cfg, 'POST', `/v1/community-intake/${encodeURIComponent(id)}/review`, body);
}
