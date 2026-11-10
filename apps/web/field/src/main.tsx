import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  QueuedMutation,
  QueuedSignal,
  classifyReplay,
  enqueueMutation,
  enqueueSignal,
  newClientId,
  readMutationQueue,
  readSignalQueue,
  removeMutation,
  removeSignal
} from './offline-queue';
import {
  ACTION_STATUSES,
  OUTCOME_RESULTS,
  buildActionUpdatePayload,
  buildOutcomePayload
} from './mutation-builders';
import './styles.css';

type Tab = 'capture' | 'update' | 'queue' | 'sync';
type ItemState = 'conflict' | 'rejected' | 'retry';

const EMPTY_ACTION = { actionId: '', expectedVersion: '', status: '', dueAt: '', completionEvidence: '' };
const EMPTY_OUTCOME = {
  signalId: '',
  actionId: '',
  indicatorName: '',
  result: 'inconclusive',
  baselineValue: '',
  targetValue: '',
  followUpValue: '',
  unit: '',
  evidenceSummary: '',
  evidenceReference: '',
  uncertaintyNote: ''
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORIES = [
  { value: 'unusual_illness', label: 'Unusual illness' },
  { value: 'environmental_hazard', label: 'Environmental hazard (water, vector, sanitation)' },
  { value: 'service_disruption', label: 'Health service disruption' },
  { value: 'other', label: 'Other community signal' }
];

const SOURCES = [
  { value: 'community_report', label: 'Community report' },
  { value: 'facility_report', label: 'Facility report' },
  { value: 'field_observation', label: 'Field observation' },
  { value: 'research', label: 'Research' },
  { value: 'other', label: 'Other' }
];

const PRECISION = [
  { value: 'community', label: 'Community' },
  { value: 'facility', label: 'Facility catchment' },
  { value: 'district', label: 'District' }
];

function App() {
  const [tab, setTab] = useState<Tab>('capture');
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [signals, setSignals] = useState<QueuedSignal[]>([]);
  const [mutations, setMutations] = useState<QueuedMutation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'warn' | 'danger'; text: string } | null>(null);

  // Capture form
  const [category, setCategory] = useState('unusual_illness');
  const [summary, setSummary] = useState('');
  const [area, setArea] = useState('');
  const [precision, setPrecision] = useState('community');
  const [source, setSource] = useState('community_report');

  // Session token is held in memory only — never persisted
  const [authToken, setAuthToken] = useState('');
  const [apiBase, setApiBase] = useState('');
  // Organization selector (UUID). Not a credential; the API still checks membership for the token's user.
  const [organizationId, setOrganizationId] = useState('');
  const [updateKind, setUpdateKind] = useState<'action' | 'outcome'>('action');
  const [actionForm, setActionForm] = useState(EMPTY_ACTION);
  const [outcomeForm, setOutcomeForm] = useState(EMPTY_OUTCOME);
  // Per-item result of the last sync attempt, so conflicts and rejections stay visible in the queue.
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  // Short server error code per item (for example `invalid_signal`), so a rejected item explains itself.
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({});

  const refreshQueues = useCallback(async () => {
    const [s, m] = await Promise.all([readSignalQueue(), readMutationQueue()]);
    setSignals(s);
    setMutations(m);
  }, []);

  useEffect(() => {
    void refreshQueues();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshQueues]);

  async function queueSignal(e: React.FormEvent) {
    e.preventDefault();
    if (summary.trim().length < 10 || !area.trim()) {
      setMessage({ kind: 'warn', text: 'Enter an administrative area and a summary of at least 10 characters. Do not include patient names or identifiers.' });
      return;
    }
    const item: QueuedSignal = {
      clientSubmissionId: newClientId(),
      category,
      summary: summary.trim().slice(0, 1000),
      observedAt: new Date().toISOString(),
      location: { administrativeAreaCode: area.trim(), precision },
      sourceType: source,
      queuedAt: new Date().toISOString()
    };
    await enqueueSignal(item);
    setSummary('');
    setMessage({ kind: 'info', text: 'Signal queued on device. It will sync when connectivity and a session token are available.' });
    await refreshQueues();
    setTab('queue');
  }

  async function queueActionUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!UUID_RE.test(actionForm.actionId.trim())) {
      setMessage({ kind: 'warn', text: 'Enter the action ID (UUID).' });
      return;
    }
    const built = buildActionUpdatePayload(actionForm);
    if (!built.ok) {
      setMessage({ kind: 'warn', text: built.error });
      return;
    }
    await enqueueMutation({
      clientMutationId: newClientId(),
      kind: 'action_update',
      actionId: actionForm.actionId.trim(),
      payload: built.payload,
      queuedAt: new Date().toISOString()
    });
    setActionForm(EMPTY_ACTION);
    setMessage({ kind: 'info', text: 'Action update queued on device. If the server version has changed by sync time it will be flagged as a conflict, not overwritten.' });
    await refreshQueues();
    setTab('queue');
  }

  async function queueOutcome(e: React.FormEvent) {
    e.preventDefault();
    if (!UUID_RE.test(outcomeForm.signalId.trim())) {
      setMessage({ kind: 'warn', text: 'Enter the signal ID (UUID) the action belongs to.' });
      return;
    }
    const built = buildOutcomePayload(outcomeForm, new Date().toISOString());
    if (!built.ok) {
      setMessage({ kind: 'warn', text: built.error });
      return;
    }
    await enqueueMutation({
      clientMutationId: newClientId(),
      kind: 'outcome_assessment',
      signalId: outcomeForm.signalId.trim(),
      payload: built.payload,
      queuedAt: new Date().toISOString()
    });
    setOutcomeForm(EMPTY_OUTCOME);
    setMessage({ kind: 'info', text: 'Outcome assessment queued on device. It reuses one replay key, so a retry cannot save it twice.' });
    await refreshQueues();
    setTab('queue');
  }

  /** Safe, short error code from a failed response; never echoes arbitrary server text into the UI. */
  async function reasonOf(res: Response): Promise<string | null> {
    try {
      const body = (await res.json()) as { error?: unknown };
      return typeof body.error === 'string' && /^[a-z0-9_:-]{1,80}$/i.test(body.error) ? body.error : null;
    } catch {
      return null;
    }
  }

  async function discardSignal(id: string) {
    if (!window.confirm('Remove this report from this device? It has not been accepted by the server and cannot be recovered.')) return;
    await removeSignal(id);
    setItemStates(({ [id]: _gone, ...rest }) => rest);
    await refreshQueues();
  }

  async function discardMutation(id: string) {
    if (!window.confirm('Remove this update from this device? It has not been accepted by the server and cannot be recovered.')) return;
    await removeMutation(id);
    setItemStates(({ [id]: _gone, ...rest }) => rest);
    await refreshQueues();
  }

  async function syncAll() {
    if (!online) {
      setMessage({ kind: 'warn', text: 'Device is offline. Queue is preserved; try again when connectivity returns.' });
      return;
    }
    if (!authToken.trim()) {
      setMessage({ kind: 'warn', text: 'Provide a short-lived access token for this session. Tokens are never stored on device.' });
      return;
    }
    if (!UUID_RE.test(organizationId.trim())) {
      setMessage({ kind: 'warn', text: 'Enter the organization ID (UUID) you were given; the API requires it on every request.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const orgId = organizationId.trim();
    const base = apiBase.trim().replace(/\/$/, '') || '';
    let accepted = 0;
    let conflicts = 0;
    let retryable = 0;
    let rejected = 0;
    // 'network' = a request never got a response; 'auth' = the server refused the token or organization.
    // Either way the remaining items are left untouched instead of being marked rejected.
    let stopped: null | 'network' | 'auth' = null;
    const states: Record<string, ItemState> = {};
    const reasons: Record<string, string> = {};

    try {
      const pendingSignals = await readSignalQueue();
      for (const item of pendingSignals) {
        let res: Response;
        try {
          res = await fetch(`${base}/v1/signals`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken.trim()}`,
              'x-organization-id': orgId,
              'Idempotency-Key': item.clientSubmissionId
            },
            body: JSON.stringify({
              clientSubmissionId: item.clientSubmissionId,
              category: item.category,
              summary: item.summary,
              observedAt: item.observedAt,
              location: item.location,
              sourceType: item.sourceType
            })
          });
        } catch {
          stopped = 'network';
          break;
        }
        if (res.status === 401 || res.status === 403) { stopped = 'auth'; break; }
        const outcome = classifyReplay(res.status);
        if (outcome === 'accepted' || outcome === 'replayed') {
          await removeSignal(item.clientSubmissionId);
          accepted += 1;
        } else if (outcome === 'conflict') {
          conflicts += 1;
          states[item.clientSubmissionId] = 'conflict';
        } else if (outcome === 'retryable') {
          retryable += 1;
          states[item.clientSubmissionId] = 'retry';
        } else {
          rejected += 1;
          states[item.clientSubmissionId] = 'rejected';
          const reason = await reasonOf(res);
          if (reason) reasons[item.clientSubmissionId] = reason;
        }
      }

      const pendingMutations = stopped ? [] : await readMutationQueue();
      for (const item of pendingMutations) {
        const isOutcome = item.kind === 'outcome_assessment';
        if (isOutcome && !item.signalId) {
          retryable += 1; // cannot be replayed without its signal; keep it visible in the queue
          continue;
        }
        const path = isOutcome
          ? `${base}/v1/signals/${encodeURIComponent(item.signalId!)}/outcomes`
          : `${base}/v1/actions/${encodeURIComponent(item.actionId ?? '')}`;
        let res: Response;
        try {
          res = await fetch(path, {
            method: isOutcome ? 'POST' : 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken.trim()}`,
              'x-organization-id': orgId,
              // The outcome route reads the replay key from this header; request bodies are strict schemas.
              ...(isOutcome ? { 'x-client-mutation-id': item.clientMutationId } : {})
            },
            body: JSON.stringify(item.payload)
          });
        } catch {
          stopped = 'network';
          break;
        }
        if (res.status === 401 || res.status === 403) { stopped = 'auth'; break; }
        const outcome = classifyReplay(res.status);
        if (outcome === 'accepted' || outcome === 'replayed') {
          await removeMutation(item.clientMutationId);
          accepted += 1;
        } else if (outcome === 'conflict') {
          conflicts += 1;
          states[item.clientMutationId] = 'conflict';
          const reason = await reasonOf(res);
          if (reason) reasons[item.clientMutationId] = reason;
        } else if (outcome === 'retryable') {
          retryable += 1;
          states[item.clientMutationId] = 'retry';
        } else {
          rejected += 1;
          states[item.clientMutationId] = 'rejected';
          const reason = await reasonOf(res);
          if (reason) reasons[item.clientMutationId] = reason;
        }
      }
      setItemStates((prev) => ({ ...prev, ...states }));
      setItemReasons((prev) => ({ ...prev, ...reasons }));

      const summary = `${accepted} accepted, ${conflicts} conflict(s), ${rejected} rejected by the server, ${retryable} to retry.`;
      if (stopped === 'auth') {
        setMessage({
          kind: 'danger',
          text: `The server refused your token or organization, so syncing stopped. ${summary} Nothing else was marked rejected; check the token and organization ID and try again.`
        });
      } else if (stopped === 'network') {
        setMessage({
          kind: 'danger',
          text: `Network error during sync, so syncing stopped. ${summary} Remaining items are still on this device and can be retried.`
        });
      } else {
        setMessage({
          kind: conflicts || retryable || rejected ? 'warn' : 'info',
          text: `Sync finished: ${summary} Rejected and conflicting items stay in the queue until you remove them.`
        });
      }
    } catch {
      setMessage({
        kind: 'danger',
        text: 'Could not read or update the device queue. Nothing was deleted; try again.'
      });
    } finally {
      // Always show what is really left on the device, even after a partial failure.
      try { await refreshQueues(); } catch { /* keep the previous view */ }
      setBusy(false);
    }
  }

  const pendingCount = signals.length + mutations.length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">PP</div>
          <div className="brand-text">
            <strong>PubliPulse Field</strong>
            <span>Offline-first capture · no tokens on disk</span>
          </div>
        </div>
        <div className="connection-indicator" role="status" aria-label={online ? 'Connection status: online' : 'Connection status: offline'}><span className={`status-dot ${online ? 'online' : ''}`} aria-hidden="true" /><span>{online ? 'Online' : 'Offline'}</span></div>
      </header>

      <nav className="nav" aria-label="Field workspace navigation">
        <button type="button" className={tab === 'capture' ? 'active' : ''} aria-pressed={tab === 'capture'} onClick={() => setTab('capture')}>
          Capture
        </button>
        <button type="button" className={tab === 'update' ? 'active' : ''} aria-pressed={tab === 'update'} onClick={() => setTab('update')}>
          Update
        </button>
        <button type="button" className={tab === 'queue' ? 'active' : ''} aria-pressed={tab === 'queue'} onClick={() => setTab('queue')}>
          Queue{pendingCount ? ` (${pendingCount})` : ''}
        </button>
        <button type="button" className={tab === 'sync' ? 'active' : ''} aria-pressed={tab === 'sync'} onClick={() => setTab('sync')}>
          Sync
        </button>
      </nav>

      <main>
        {message && <div className={`banner ${message.kind}`}>{message.text}</div>}

        {tab === 'capture' && (
          <form className="card" onSubmit={queueSignal}>
            <h2>Record a signal</h2>
            <p className="lead">
              Field observations only. Never enter patient names, national IDs, phone numbers, or precise household addresses.
              The server also rejects long digit runs, including dates written like 2026-11-03 or 03.11.2026; write the date in words (3 Nov 2026) instead.
            </p>

            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="summary">What was observed?</label>
              <textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Several households report fever near the borehole this week"
                minLength={10}
                maxLength={1000}
                required
              />
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="area">Admin area code</label>
                <input
                  id="area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. UG-KLA-01"
                  maxLength={80}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="precision">Precision</label>
                <select id="precision" value={precision} onChange={(e) => setPrecision(e.target.value)}>
                  {PRECISION.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="source">Source</label>
              <select id="source" value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="actions">
              <button className="primary" type="submit">
                Queue on this device
              </button>
            </div>
          </form>
        )}

        {tab === 'update' && (
          <section className="card">
            <h2>Update a response</h2>
            <p className="lead">
              Queue an action update or an outcome assessment while offline. Do not enter patient names, national IDs or phone numbers.
            </p>
            <div className="field">
              <label htmlFor="update-kind">What are you recording?</label>
              <select id="update-kind" value={updateKind} onChange={(e) => setUpdateKind(e.target.value as 'action' | 'outcome')}>
                <option value="action">Action update (status, due date, completion)</option>
                <option value="outcome">Outcome assessment (did it work?)</option>
              </select>
            </div>

            {updateKind === 'action' ? (
              <form onSubmit={queueActionUpdate}>
                <div className="field">
                  <label htmlFor="au-action">Action ID</label>
                  <input id="au-action" value={actionForm.actionId} onChange={(e) => setActionForm({ ...actionForm, actionId: e.target.value })} autoComplete="off" placeholder="UUID" required />
                </div>
                <div className="row">
                  <div className="field">
                    <label htmlFor="au-version">Version you last saw</label>
                    <input id="au-version" inputMode="numeric" value={actionForm.expectedVersion} onChange={(e) => setActionForm({ ...actionForm, expectedVersion: e.target.value })} placeholder="e.g. 3" required />
                  </div>
                  <div className="field">
                    <label htmlFor="au-status">New status</label>
                    <select id="au-status" value={actionForm.status} onChange={(e) => setActionForm({ ...actionForm, status: e.target.value })}>
                      <option value="">No change</option>
                      {ACTION_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="au-due">New due date (optional)</label>
                  <input id="au-due" type="datetime-local" value={actionForm.dueAt} onChange={(e) => setActionForm({ ...actionForm, dueAt: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="au-evidence">Completion evidence (required to complete)</label>
                  <textarea id="au-evidence" maxLength={4000} value={actionForm.completionEvidence} onChange={(e) => setActionForm({ ...actionForm, completionEvidence: e.target.value })} />
                </div>
                <div className="actions">
                  <button className="primary" type="submit">Queue action update</button>
                </div>
              </form>
            ) : (
              <form onSubmit={queueOutcome}>
                <div className="row">
                  <div className="field">
                    <label htmlFor="oc-signal">Signal ID</label>
                    <input id="oc-signal" value={outcomeForm.signalId} onChange={(e) => setOutcomeForm({ ...outcomeForm, signalId: e.target.value })} autoComplete="off" placeholder="UUID" required />
                  </div>
                  <div className="field">
                    <label htmlFor="oc-action">Action ID</label>
                    <input id="oc-action" value={outcomeForm.actionId} onChange={(e) => setOutcomeForm({ ...outcomeForm, actionId: e.target.value })} autoComplete="off" placeholder="UUID" required />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="oc-indicator">Indicator</label>
                  <input id="oc-indicator" minLength={2} maxLength={240} value={outcomeForm.indicatorName} onChange={(e) => setOutcomeForm({ ...outcomeForm, indicatorName: e.target.value })} placeholder="e.g. Water samples meeting safety standard" required />
                </div>
                <div className="field">
                  <label htmlFor="oc-result">Result</label>
                  <select id="oc-result" value={outcomeForm.result} onChange={(e) => setOutcomeForm({ ...outcomeForm, result: e.target.value })}>
                    {OUTCOME_RESULTS.map((r) => (
                      <option key={r} value={r}>
                        {r.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row">
                  <div className="field">
                    <label htmlFor="oc-baseline">Baseline</label>
                    <input id="oc-baseline" inputMode="decimal" value={outcomeForm.baselineValue} onChange={(e) => setOutcomeForm({ ...outcomeForm, baselineValue: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="oc-target">Target</label>
                    <input id="oc-target" inputMode="decimal" value={outcomeForm.targetValue} onChange={(e) => setOutcomeForm({ ...outcomeForm, targetValue: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="oc-followup">Follow-up</label>
                    <input id="oc-followup" inputMode="decimal" value={outcomeForm.followUpValue} onChange={(e) => setOutcomeForm({ ...outcomeForm, followUpValue: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="oc-unit">Unit</label>
                  <input id="oc-unit" maxLength={80} value={outcomeForm.unit} onChange={(e) => setOutcomeForm({ ...outcomeForm, unit: e.target.value })} placeholder="%, cases, samples" />
                </div>
                <div className="field">
                  <label htmlFor="oc-evidence">Evidence summary and method</label>
                  <textarea id="oc-evidence" minLength={5} maxLength={3000} value={outcomeForm.evidenceSummary} onChange={(e) => setOutcomeForm({ ...outcomeForm, evidenceSummary: e.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="oc-ref">Evidence reference (optional)</label>
                  <input id="oc-ref" maxLength={240} value={outcomeForm.evidenceReference} onChange={(e) => setOutcomeForm({ ...outcomeForm, evidenceReference: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="oc-uncertainty">Uncertainty / limitations (required if inconclusive)</label>
                  <textarea id="oc-uncertainty" maxLength={3000} value={outcomeForm.uncertaintyNote} onChange={(e) => setOutcomeForm({ ...outcomeForm, uncertaintyNote: e.target.value })} />
                </div>
                <div className="actions">
                  <button className="primary" type="submit">Queue outcome assessment</button>
                </div>
              </form>
            )}
          </section>
        )}

        {tab === 'queue' && (
          <section className="card">
            <h2>Device queue</h2>
            <p className="lead">
              Items stay here until the server accepts them. Conflicts remain visible; nothing is deleted silently.
            </p>
            {pendingCount === 0 ? (
              <p className="empty">Queue is empty.</p>
            ) : (
              <div className="queue-list">
                {signals.map((s) => (
                  <div className="queue-item" key={s.clientSubmissionId}>
                    <div>
                      <strong>{s.summary.slice(0, 80)}</strong>
                      <small>
                        {s.category.replaceAll('_', ' ')} · {s.location.administrativeAreaCode} ·{' '}
                        {new Date(s.queuedAt).toLocaleString()}
                      </small>
                    </div>
                    <div className="queue-side">
                      <span className={`pill ${itemStates[s.clientSubmissionId] ? 'danger' : 'pending'}`}>
                        {itemStates[s.clientSubmissionId] ?? 'signal'}
                      </span>
                      {itemReasons[s.clientSubmissionId] && <small>Server said: {itemReasons[s.clientSubmissionId]}</small>}
                      {(itemStates[s.clientSubmissionId] === 'rejected' || itemStates[s.clientSubmissionId] === 'conflict') && (
                        <button type="button" className="secondary" onClick={() => void discardSignal(s.clientSubmissionId)}>Remove from device</button>
                      )}
                    </div>
                  </div>
                ))}
                {mutations.map((m) => (
                  <div className="queue-item" key={m.clientMutationId}>
                    <div>
                      <strong>{m.kind.replaceAll('_', ' ')}</strong>
                      <small>{new Date(m.queuedAt).toLocaleString()}</small>
                    </div>
                    <div className="queue-side">
                      <span className={`pill ${itemStates[m.clientMutationId] ? 'danger' : 'pending'}`}>
                        {itemStates[m.clientMutationId] ?? 'mutation'}
                      </span>
                      {itemReasons[m.clientMutationId] && <small>Server said: {itemReasons[m.clientMutationId]}</small>}
                      {(itemStates[m.clientMutationId] === 'rejected' || itemStates[m.clientMutationId] === 'conflict') && (
                        <button type="button" className="secondary" onClick={() => void discardMutation(m.clientMutationId)}>Remove from device</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'sync' && (
          <section className="card">
            <h2>Sync to PubliPulse API</h2>
            <p className="lead">
              Paste a short-lived access token for this session only. It is held in memory and never written to IndexedDB or
              local storage.
            </p>

            <div className="field">
              <label htmlFor="api">API base (optional)</label>
              <input
                id="api"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                placeholder="https://api.example.org  (leave blank for same origin / proxy)"
              />
            </div>

            <div className="field">
              <label htmlFor="org">Organization ID</label>
              <input
                id="org"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                autoComplete="off"
                placeholder="UUID of your organization"
              />
            </div>

            <div className="field">
              <label htmlFor="token">Session access token</label>
              <input
                id="token"
                type="password"
                autoComplete="off"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Bearer token — not stored on device"
              />
            </div>

            <div className="actions">
              <button className="primary" type="button" disabled={busy || pendingCount === 0} onClick={() => void syncAll()}>
                {busy ? 'Syncing…' : `Sync ${pendingCount} pending item(s)`}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setAuthToken('');
                  setMessage({ kind: 'info', text: 'Session token cleared from memory.' });
                }}
              >
                Clear token from memory
              </button>
            </div>
          </section>
        )}

        <p className="footer-note">
          PubliPulse Field is an operational prototype for intermittent connectivity. Production use requires approved privacy,
          retention, lawful-basis, and managed-device controls. See docs/FIELD_OFFLINE_PILOT.md and docs/PHASE_4_FIELD_OPERATIONS.md.
        </p>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
