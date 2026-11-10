import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, Notice } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { WEEK_LABEL } from '../data/org';
import { ConnectedWorkspace } from './ConnectedWorkspace';

const OWNERS = ['District lead', 'Surveillance lead', 'Response lead', 'Laboratory lead', 'Programme lead'];

export function WeeklyReviewView() {
  const { role, signals, gaps, actions } = useApp();
  const { decisions, addDecision, signedOffAt, signOffWeek } = useWorkspace();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [owner, setOwner] = useState(OWNERS[0]);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const openSignals = signals.filter((s) => s.status !== 'Closed').length;
  const breached = gaps.filter((g) => g.status === 'Breached').length;
  const done = actions.filter((a) => a.status === 'Completed').length;
  const isAdmin = role === 'admin';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || detail.trim().length < 5) { setError('Give the decision a short title and say what was decided.'); return; }
    addDecision(title.trim(), detail.trim(), owner);
    setTitle(''); setDetail(''); setError('');
  };

  return (
    <div>
      <section className="pp-card pp-mb" aria-labelledby="week-title">
        <div className="pp-row-wrap-between">
          <div>
            <h3 id="week-title" className="pp-title-sm">{WEEK_LABEL} review, Kasese and Bundibugyo sector</h3>
            <p className="pp-hint">Look at how the week went, record the decisions, then sign off.</p>
          </div>
          {signedOffAt ? (
            <span className="pp-chip-tag" role="status">Signed off {signedOffAt} · this session only</span>
          ) : isAdmin ? (
            confirming ? (
              <div className="pp-row-wrap" role="group" aria-label="Confirm sign-off">
                <span className="pp-text-sm">Sign off {WEEK_LABEL}?</span>
                <Button onClick={() => { signOffWeek(); setConfirming(false); }}>Yes, sign off</Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            ) : (
              <Button onClick={() => setConfirming(true)}>Sign off {WEEK_LABEL}</Button>
            )
          ) : (
            <span className="pp-hint">Administrators sign off the weekly review.</span>
          )}
        </div>
      </section>

      <div className="pp-metric-grid">
        <div className="pp-metric-card pp-passive"><p className="label">Open signals</p><p className="value">{openSignals}</p><p className="sub">Not yet closed</p></div>
        <div className="pp-metric-card pp-passive"><p className="label">Response targets missed</p><p className="value">{breached}</p><p className="sub">Action gaps past their target</p></div>
        <div className="pp-metric-card pp-passive"><p className="label">Actions finished</p><p className="value">{done} of {actions.length}</p><p className="sub">This session</p></div>
        <div className="pp-metric-card pp-passive"><p className="label">Decisions this week</p><p className="value">{decisions.length}</p><p className="sub">Recorded below</p></div>
      </div>

      <section className="pp-card pp-mb" aria-labelledby="decisions-title">
        <h3 id="decisions-title" className="pp-title-sm">Decisions</h3>
        {decisions.length === 0 ? (
          <EmptyState title="No decisions recorded" hint={isAdmin ? 'Add the first decision for this week below.' : 'Administrators record the weekly decisions.'} />
        ) : (
          <ul className="pp-stack-sm pp-plain-list">
            {decisions.map((d) => (
              <li key={d.id} className="pp-panel-soft">
                <strong className="pp-text-accent">{d.title}</strong>
                <p className="pp-hint">{d.detail}</p>
                <p className="pp-hint">Owner: {d.owner} · {d.week}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && !signedOffAt && (
        <section className="pp-card pp-mb" aria-labelledby="add-decision-title">
          <h3 id="add-decision-title" className="pp-title-sm">Add a decision</h3>
          <form className="pp-stack-sm pp-mt-sm" onSubmit={submit} noValidate>
            <label className="pp-field">Decision<input className="pp-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example: Extend the vaccination drive" /></label>
            <label className="pp-field">What was decided?<textarea className="pp-input" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} /></label>
            <label className="pp-field">Owner
              <select className="pp-input" value={owner} onChange={(e) => setOwner(e.target.value)}>
                {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            {error && <Notice tone="danger" label="Check this:">{error}</Notice>}
            <div><Button type="submit">Add decision</Button></div>
          </form>
        </section>
      )}
      {signedOffAt && <Notice tone="info" label="Locked:">New decisions are closed for {WEEK_LABEL} once it is signed off. This is not recorded on the server.</Notice>}

      {isAdmin && <ConnectedWorkspace variant="compact" />}
    </div>
  );
}
