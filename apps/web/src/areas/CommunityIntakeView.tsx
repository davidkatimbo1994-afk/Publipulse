import { useState } from 'react';
import { Button, EmptyState, Notice } from '../components/ui';
import { loadCommunityQueue, loadCommunityStats, reviewCommunitySubmission } from '../lib/api-client';
import type { CommunityReviewBody } from '../lib/api-client';
import { ageText, categoryLabel, parseQueue, parseStats, reviewErrorText, validateReview } from '../data/communityViews';
import type { QueueRow, QueueStatsView } from '../data/communityViews';
import { NeedsConnection, useLiveConfig, useRunner } from './resource-shared';

type Decision = 'promote' | 'merge' | 'dismiss';

export function CommunityIntakeView() {
  const cfg = useLiveConfig();
  const load = useRunner();
  const decide = useRunner();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [stats, setStats] = useState<QueueStatsView | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ decision: Decision; summary: string; signalId: string; reason: string; precision: 'community' | 'district' }>({ decision: 'promote', summary: '', signalId: '', reason: '', precision: 'community' });
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const patch = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  if (!cfg) return <NeedsConnection what="Community reports" />;

  const refresh = (all = showDone) => load.run(async () => {
    const [q, s] = await Promise.all([loadCommunityQueue(cfg, all ? 'all' : 'pending'), loadCommunityStats(cfg)]);
    setRows(parseQueue(q)); setStats(parseStats(s));
  });

  const open = (id: string) => { setOpenId(id); setFormError(''); setMessage(''); setForm({ decision: 'promote', summary: '', signalId: '', reason: '', precision: 'community' }); };

  const submit = async (id: string) => {
    const problem = validateReview(form);
    if (problem) { setFormError(problem); return; }
    setFormError(''); setMessage('');
    const body: CommunityReviewBody = form.decision === 'promote'
      ? { decision: 'promote', precision: form.precision, ...(form.summary.trim() ? { summary: form.summary.trim() } : {}) }
      : form.decision === 'merge'
        ? { decision: 'merge', signalId: form.signalId.trim(), ...(form.reason.trim() ? { reason: form.reason.trim() } : {}) }
        : { decision: 'dismiss', reason: form.reason.trim() };
    const ok = await decide.run(async () => {
      try {
        await reviewCommunitySubmission(cfg, id, body);
        setMessage(form.decision === 'promote' ? 'Signal created from this report.' : form.decision === 'merge' ? 'Linked to the existing signal.' : 'Dismissed.');
      } catch (e) { throw new Error(reviewErrorText(e instanceof Error ? e.message : 'Request failed.')); }
    });
    if (ok) { setOpenId(null); await refresh(); }
  };

  return (
    <div className="pp-stack">
      <section className="pp-card" aria-labelledby="ci-title">
        <div className="pp-row-wrap-between pp-mb">
          <div>
            <h3 id="ci-title" className="pp-title-sm">Community reports waiting for review</h3>
            <p className="pp-hint">Reports sent by USSD or SMS stay here until a person decides. Nothing starts a response clock until it becomes a signal.</p>
          </div>
          <div className="pp-row-wrap">
            <label className="pp-check"><input type="checkbox" checked={showDone} onChange={(e) => { setShowDone(e.target.checked); if (rows) void refresh(e.target.checked); }} /> Show decided reports</label>
            <Button onClick={() => void refresh()} disabled={load.busy}>{load.busy ? 'Loading…' : rows ? 'Refresh' : 'Load reports'}</Button>
          </div>
        </div>
        {load.error && <Notice tone="danger" label="Could not load:">{reviewErrorText(load.error)}</Notice>}
        {message && !decide.error && <Notice tone="success" label="Done:">{message}</Notice>}

        {stats && (
          <div className="pp-metric-grid">
            <div className="pp-metric-card pp-passive"><p className="label">Waiting</p><p className="value">{stats.pending}</p><p className="sub">{stats.urgentPending} marked urgent</p></div>
            <div className="pp-metric-card pp-passive"><p className="label">Oldest waiting</p><p className="value">{ageText(stats.oldestPendingHours)}</p><p className="sub">target 24 h, to calibrate</p></div>
            <div className="pp-metric-card pp-passive"><p className="label">Decided, last 30 days</p><p className="value">{stats.reviewedLast30Days}</p><p className="sub">median {ageText(stats.medianHoursToReview)} to decide</p></div>
          </div>
        )}

        {rows === null && !load.error && <EmptyState title="Nothing loaded yet" hint="Only reviewers, administrators and owners can see this queue." />}
        {rows !== null && rows.length === 0 && <EmptyState title="No reports" hint={showDone ? 'No community reports have arrived yet.' : 'The queue is empty.'} />}
        {rows !== null && rows.length > 0 && (
          <div className="pp-table-wrap pp-mt-sm" tabIndex={0} role="region" aria-label="Community reports, scrolls sideways on small screens">
            <table className="pp-table">
              <caption className="pp-sr-only">Community reports, urgent and oldest first</caption>
              <thead><tr><th scope="col">Received</th><th scope="col">Urgent</th><th scope="col">What</th><th scope="col">Area</th><th scope="col">Note</th><th scope="col">Via</th><th scope="col">Status</th><th scope="col"><span className="pp-sr-only">Review</span></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.receivedAt.slice(0, 16).replace('T', ' ')}</td>
                    <td>{r.urgent ? <span className="pp-level critical"><span aria-hidden="true">!!</span> Urgent</span> : 'No'}</td>
                    <td className="pp-strong">{categoryLabel(r.category)}</td>
                    <td>{r.areaCode}</td>
                    <td>{r.narrative ?? '—'}</td>
                    <td>{r.channel.toUpperCase()}</td>
                    <td>{r.decision === null ? 'Waiting' : r.decision === 'promoted' ? 'Became a signal' : r.decision === 'merged' ? 'Linked to a signal' : 'Dismissed'}</td>
                    <td>{r.decision === null && <Button variant="secondary" onClick={() => open(r.id)} aria-label={`Review the ${categoryLabel(r.category)} report from ${r.areaCode}`}>Review</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openId && (
        <section className="pp-card" aria-labelledby="ci-review-title">
          <h3 id="ci-review-title" className="pp-title-sm">Decide on this report</h3>
          <div className="pp-row-wrap pp-mb" role="group" aria-label="Decision">
            {([['promote', 'Create a signal'], ['merge', 'Same as an existing signal'], ['dismiss', 'Dismiss']] as const).map(([d, label]) => (
              <Button key={d} variant={form.decision === d ? 'primary' : 'secondary'} aria-pressed={form.decision === d} onClick={() => patch('decision', d)}>{label}</Button>
            ))}
          </div>
          {form.decision === 'promote' && (
            <div className="pp-stack-sm">
              <label className="pp-field">Summary (optional)
                <textarea className="pp-input" rows={3} maxLength={1000} value={form.summary} onChange={(e) => patch('summary', e.target.value)} placeholder="Leave empty to use the standard summary built from the report." />
              </label>
              <label className="pp-field">How precise is the location?
                <select className="pp-input" value={form.precision} onChange={(e) => patch('precision', e.target.value as 'community' | 'district')}>
                  <option value="community">Community</option><option value="district">District</option>
                </select>
              </label>
              <p className="pp-hint">Do not add names, phone numbers or ID numbers. The signal will be marked as a community report and start as submitted.</p>
            </div>
          )}
          {form.decision === 'merge' && (
            <div className="pp-stack-sm">
              <label className="pp-field">Signal ID<input className="pp-input pp-mono" value={form.signalId} onChange={(e) => patch('signalId', e.target.value)} /></label>
              <label className="pp-field">Reason (optional)<input className="pp-input" value={form.reason} onChange={(e) => patch('reason', e.target.value)} /></label>
            </div>
          )}
          {form.decision === 'dismiss' && (
            <label className="pp-field">Why is this being dismissed?
              <input className="pp-input" maxLength={500} value={form.reason} onChange={(e) => patch('reason', e.target.value)} placeholder="e.g. Not a health event" />
            </label>
          )}
          {formError && <Notice tone="danger" label="Check this:">{formError}</Notice>}
          {decide.error && <Notice tone="danger" label="Not saved:">{decide.error}</Notice>}
          <div className="pp-row-wrap pp-mt-sm">
            <Button onClick={() => void submit(openId)} disabled={decide.busy}>{decide.busy ? 'Saving…' : 'Save decision'}</Button>
            <Button variant="secondary" onClick={() => setOpenId(null)}>Cancel</Button>
          </div>
          <p className="pp-hint">A decision is final and cannot be edited.</p>
        </section>
      )}
    </div>
  );
}
