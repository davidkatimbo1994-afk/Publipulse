/**
 * Admin-facing connected API workspace.
 * Tokens stay in React state only — never persisted.
 * Extracted from App.legacy.tsx loaders; same endpoints and headers.
 */
import { useEffect, useState } from 'react';
import { SevenOneSevenCharts, WeeklyReviewCharts } from '../components/charts/LiveCharts';
import type { ApiRecord, ConnectedWorkflow } from '../lib/types';
import {
  type ApiConfig,
  isConfigReady,
  loadConnectedWorkflow,
  loadLearningSummary,
  loadSevenOneSeven,
  loadWeeklyReview
} from '../lib/api-client';
import { useApp } from '../context/AppContext';

const EMPTY_CFG: ApiConfig = {
  baseUrl: '',
  organizationId: '',
  accessToken: '',
  signalId: '',
  actionId: ''
};

const EMPTY_CONNECTED: ConnectedWorkflow = {
  signal: null,
  evidence: [],
  investigations: [],
  decisions: [],
  actions: [],
  outcomes: [],
  handoffs: [],
  gaps: []
};

function countLabel(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

export function ConnectedWorkspace({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { sessionApiConfig, setSessionApiConfig } = useApp();
  // Start from the session config so moving between working areas does not blank the form or drop the connection.
  const [cfg, setCfg] = useState<ApiConfig>(() => sessionApiConfig ?? EMPTY_CFG);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState<ConnectedWorkflow>(EMPTY_CONNECTED);
  const [weekly, setWeekly] = useState<ApiRecord | null>(null);
  const [learning, setLearning] = useState<ApiRecord | null>(null);
  const [clocks, setClocks] = useState<ApiRecord | null>(null);

  const patch = (key: keyof ApiConfig, value: string) => setCfg((prev) => ({ ...prev, [key]: value }));

  // Keep session credentials in memory for optional live signal submit. This is an effect, not a state-updater side
  // effect: updating the provider while this component renders is a React error and runs twice in development.
  useEffect(() => {
    setSessionApiConfig(isConfigReady(cfg) ? cfg : null);
  }, [cfg, setSessionApiConfig]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try {
      await fn();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  const onLoadWorkflow = () =>
    run(async () => {
      const result = await loadConnectedWorkflow(cfg);
      setConnected(result.connected);
      setNotice(result.notice);
    });

  const onLoadWeekly = () =>
    run(async () => {
      const review = await loadWeeklyReview(cfg);
      setWeekly(review);
      setNotice('Weekly district review loaded from the authorized organization.');
    });

  const onLoadLearning = () =>
    run(async () => {
      const summary = await loadLearningSummary(cfg);
      setLearning(summary);
      setNotice('Learning summary loaded (operational review prompts only).');
    });

  const onLoadClocks = () =>
    run(async () => {
      const summary = await loadSevenOneSeven(cfg);
      setClocks(summary);
      setNotice('7-1-7-aligned clocks loaded with outcome-completeness context.');
    });

  return (
    <div className="pp-card" style={{ marginTop: variant === 'full' ? 0 : 14 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 className="pp-title-sm">Connected API Workspace</h3>
        <p className="pp-hint">
          Session credentials only — never stored on this device. Same routes and headers as the prior
          command center.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onLoadWorkflow();
        }} className="pp-stack"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          <label className="pp-field">
            API base URL
            <input
              value={cfg.baseUrl}
              onChange={(e) => patch('baseUrl', e.target.value)}
              placeholder="https://api.example.org"
              autoComplete="off" className="pp-input"
            />
          </label>
          <label className="pp-field">
            Organization ID
            <input
              value={cfg.organizationId}
              onChange={(e) => patch('organizationId', e.target.value)}
              placeholder="UUID"
              autoComplete="off" className="pp-input"
            />
          </label>
          <label className="pp-field">
            Access token (memory only)
            <input
              type="password"
              value={cfg.accessToken}
              onChange={(e) => patch('accessToken', e.target.value)}
              placeholder="Bearer token"
              autoComplete="off" className="pp-input"
            />
          </label>
          <label className="pp-field">
            Signal ID
            <input
              value={cfg.signalId}
              onChange={(e) => patch('signalId', e.target.value)}
              placeholder="signal UUID"
              autoComplete="off" className="pp-input"
            />
          </label>
          <label className="pp-field">
            Action ID (optional)
            <input
              value={cfg.actionId}
              onChange={(e) => patch('actionId', e.target.value)}
              placeholder="action UUID"
              autoComplete="off" className="pp-input"
            />
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="submit" className="pp-primary-btn" disabled={busy || !isConfigReady(cfg)}>
            {busy ? 'Loading…' : 'Load connected workflow'}
          </button>
          <button type="button" className="pp-btn-secondary" disabled={busy || !isConfigReady(cfg)} onClick={() => void onLoadWeekly()}>
            Weekly review
          </button>
          <button type="button" className="pp-btn-secondary" disabled={busy || !isConfigReady(cfg)} onClick={() => void onLoadLearning()}>
            Learning summary
          </button>
          <button type="button" className="pp-btn-secondary" disabled={busy || !isConfigReady(cfg)} onClick={() => void onLoadClocks()}>
            7-1-7 clocks
          </button>
        </div>
        {!isConfigReady(cfg) && (
          <p className="pp-hint" role="note">These buttons switch on once the API base URL, organization ID and access token above are filled in.</p>
        )}
      </form>

      {notice && (
        <p role="status" style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--pp-muted)' }}>
          {notice}
        </p>
      )}

      {(connected.signal || connected.actions.length > 0) && (
        <div className="pp-metric-grid" style={{ marginTop: 14, marginBottom: 0 }}>
          <div className="pp-metric-card pp-passive">
            <p className="label">Signal</p>
            <p className="value" style={{ fontSize: 14 }}>
              {connected.signal ? String(connected.signal.id ?? 'found') : '—'}
            </p>
            <p className="sub">{countLabel(connected.evidence.length, 'evidence item')}</p>
          </div>
          <div className="pp-metric-card pp-passive">
            <p className="label">Actions</p>
            <p className="value">{connected.actions.length}</p>
            <p className="sub">{countLabel(connected.handoffs.length, 'handoff')}</p>
          </div>
          <div className="pp-metric-card pp-passive">
            <p className="label">Outcomes</p>
            <p className="value">{connected.outcomes.length}</p>
            <p className="sub">{countLabel(connected.investigations.length, 'investigation')}</p>
          </div>
          <div className="pp-metric-card pp-passive">
            <p className="label">Gaps (signal)</p>
            <p className="value">{connected.gaps.length}</p>
            <p className="sub">{countLabel(connected.decisions.length, 'decision')}</p>
          </div>
        </div>
      )}

      {weekly && (
        <div className="pp-mt-sm">
          <WeeklyReviewCharts payload={weekly} />
          <details className="pp-panel-soft pp-mt-sm">
            <summary><strong>Weekly review payload</strong></summary>
            <pre className="pp-pre">{JSON.stringify(weekly, null, 2).slice(0, 1200)}</pre>
          </details>
        </div>
      )}
      {learning && (
        <div className="pp-panel-soft pp-mt-sm">
          <strong>Learning summary</strong>
          <pre className="pp-pre">
            {JSON.stringify(learning, null, 2).slice(0, 1200)}
          </pre>
        </div>
      )}
      {clocks && (
        <div className="pp-mt-sm">
          <SevenOneSevenCharts payload={clocks} />
          <details className="pp-panel-soft pp-mt-sm">
            <summary><strong>7-1-7 clocks payload</strong></summary>
            <pre className="pp-pre">{JSON.stringify(clocks, null, 2).slice(0, 1200)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
