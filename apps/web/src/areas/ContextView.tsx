import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, Notice } from '../components/ui';
import { listContextObservations, loadSignalContext, recordContextObservation } from '../lib/api-client';
import { DEVIATION_LABEL, parseContextObservations, parseSignalContext, validateContextForm } from '../data/resourceViews';
import type { ContextObservationRow, SignalContextData } from '../data/resourceViews';
import { NeedsConnection, useLiveConfig, useMutationId, useRunner } from './resource-shared';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ObservationTable({ rows, label }: { rows: ContextObservationRow[]; label: string }) {
  return (
    <div className="pp-table-wrap pp-mt-sm" tabIndex={0} role="region" aria-label={`${label}, scrolls sideways on small screens`}>
      <table className="pp-table">
        <caption className="pp-sr-only">{label}</caption>
        <thead><tr><th scope="col">Area</th><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Period</th><th scope="col">Source</th></tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="pp-strong">{o.areaCode}</td>
              <td>{o.metricCode}</td>
              <td>{o.value} {o.unit}</td>
              <td>{o.periodStart} to {o.periodEnd}</td>
              <td>{o.sourceUri ? <a href={o.sourceUri} target="_blank" rel="noopener noreferrer">{o.sourceLabel}</a> : o.sourceLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContextView() {
  const cfg = useLiveConfig();
  const forSignal = useRunner();
  const recent = useRunner();
  const save = useRunner();
  const mutation = useMutationId();
  const [signalId, setSignalId] = useState(() => cfg?.signalId ?? '');
  const [ctx, setCtx] = useState<SignalContextData | null>(null);
  const [recentRows, setRecentRows] = useState<ContextObservationRow[] | null>(null);
  const [areaFilter, setAreaFilter] = useState('');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ areaCode: '', metricCode: '', value: '', unit: '', periodStart: '', periodEnd: '', sourceLabel: '', sourceUri: '' });
  const patch = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  if (!cfg) return <NeedsConnection what="Context data" />;

  const loadContext = () => forSignal.run(async () => {
    const id = signalId.trim();
    if (!UUID.test(id)) throw new Error('Enter the signal ID exactly as shown in your organisation (a long ID with dashes).');
    const parsed = parseSignalContext(await loadSignalContext(cfg, id));
    if (!parsed) throw new Error('The server answer was not in the expected form.');
    setCtx(parsed);
  });

  const loadRecent = () => recent.run(async () => {
    const area = areaFilter.trim();
    if (area !== '' && !/^[A-Za-z0-9._-]{1,80}$/.test(area)) throw new Error('Area code: letters, numbers, dot, dash or underscore only.');
    setRecentRows(parseContextObservations(await listContextObservations(cfg, area ? { areaCode: area } : {})));
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateContextForm(form);
    if (problem) { setFormError(problem); return; }
    setFormError(''); setNotice('');
    const body = {
      administrativeAreaCode: form.areaCode.trim(), metricCode: form.metricCode.trim(), value: Number(form.value), unit: form.unit.trim(),
      periodStart: form.periodStart, periodEnd: form.periodEnd, sourceLabel: form.sourceLabel.trim(), ...(form.sourceUri.trim() ? { sourceUri: form.sourceUri.trim() } : {})
    };
    const ok = await save.run(async () => {
      const result = await recordContextObservation(cfg, body, mutation.idFor(JSON.stringify(body)));
      setNotice(result.replayed === true ? 'That observation was already saved; nothing was added twice.' : 'Observation saved. Observations cannot be edited or deleted.');
    });
    if (ok) { mutation.done(); setForm((p) => ({ ...p, value: '', periodStart: '', periodEnd: '' })); }
  };

  return (
    <div>
      <section className="pp-card pp-mb" aria-labelledby="ctx-signal-title">
        <h3 id="ctx-signal-title" className="pp-title-sm">Context around a signal</h3>
        <p className="pp-hint">Rainfall, water access, prices or similar for the signal&rsquo;s area, from 28 days before to 7 days after it, compared with earlier periods.</p>
        <div className="pp-row-wrap pp-mt-sm">
          <label className="pp-field">Signal ID
            <input className="pp-input pp-mono" value={signalId} onChange={(e) => setSignalId(e.target.value)} placeholder="00000000-0000-4000-8000-000000000000" />
          </label>
          <Button onClick={() => void loadContext()} disabled={forSignal.busy}>{forSignal.busy ? 'Loading…' : 'Load context'}</Button>
        </div>
        {forSignal.error && <Notice tone="danger" label="Could not load:">{forSignal.error}</Notice>}

        {ctx && (
          <div className="pp-mt-sm">
            <Notice tone={ctx.associationOnly ? 'info' : 'warning'} label="Association in time only:">
              {ctx.associationOnly
                ? 'These figures sit in the same place and time as the signal. They do not show that one caused the other.'
                : 'The server did not confirm that this is an association only. Do not read these figures as a cause.'}
            </Notice>
            <p className="pp-hint">Area {ctx.areaCode || 'unknown'}, {ctx.from} to {ctx.to}.</p>
            {ctx.comparisons.length === 0 ? (
              <EmptyState title="No context recorded for this window" hint="Add observations for this area below, then load again." />
            ) : (
              <div className="pp-table-wrap pp-mt-sm" tabIndex={0} role="region" aria-label="Comparison with earlier periods, scrolls sideways on small screens">
                <table className="pp-table">
                  <caption className="pp-sr-only">Each metric around the signal compared with earlier periods of the same area</caption>
                  <thead><tr><th scope="col">Metric</th><th scope="col">Around signal</th><th scope="col">Earlier periods</th><th scope="col">Compared</th></tr></thead>
                  <tbody>
                    {ctx.comparisons.map((c) => (
                      <tr key={`${c.metricCode}|${c.unit}`}>
                        <td className="pp-strong">{c.metricCode}</td>
                        <td>{c.windowMean} {c.unit} <span className="pp-muted">({c.windowCount} period{c.windowCount === 1 ? '' : 's'})</span></td>
                        <td>{c.baselineMean === null ? '—' : `${c.baselineMean} ${c.unit}`} <span className="pp-muted">({c.baselineCount} period{c.baselineCount === 1 ? '' : 's'})</span></td>
                        <td><span className={`pp-dev ${c.deviation}`}>{DEVIATION_LABEL[c.deviation]}</span>{c.ratio !== null ? ` (×${c.ratio})` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {ctx.observations.length > 0 && <ObservationTable rows={ctx.observations} label="Observations in the window" />}
          </div>
        )}
      </section>

      <section className="pp-card pp-mb" aria-labelledby="ctx-recent-title">
        <h3 id="ctx-recent-title" className="pp-title-sm">Recorded observations</h3>
        <div className="pp-row-wrap pp-mt-sm">
          <label className="pp-field">Area code (optional)
            <input className="pp-input" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} />
          </label>
          <Button variant="secondary" onClick={() => void loadRecent()} disabled={recent.busy}>{recent.busy ? 'Loading…' : 'Load observations'}</Button>
        </div>
        {recent.error && <Notice tone="danger" label="Could not load:">{recent.error}</Notice>}
        {recentRows !== null && recentRows.length === 0 && <EmptyState title="No observations found" hint="Record one below." />}
        {recentRows !== null && recentRows.length > 0 && <ObservationTable rows={recentRows} label="Recorded observations, newest period first" />}
      </section>

      <section className="pp-card pp-mb" aria-labelledby="ctx-record-title">
        <h3 id="ctx-record-title" className="pp-title-sm">Record an observation</h3>
        <p className="pp-hint">Area-level figures with a named source, typed in by a person. Nothing is fetched automatically. A period can span up to 31 days. Entries are permanent and need an analyst, reviewer or administrator role.</p>
        <form className="pp-stack-sm" onSubmit={(e) => void submit(e)} noValidate>
          <div className="pp-grid-2">
            <label className="pp-field">Area code<input className="pp-input" value={form.areaCode} onChange={(e) => patch('areaCode', e.target.value)} /></label>
            <label className="pp-field">Metric code<input className="pp-input" value={form.metricCode} onChange={(e) => patch('metricCode', e.target.value)} placeholder="rainfall_mm" /></label>
            <label className="pp-field">Value<input className="pp-input" inputMode="decimal" value={form.value} onChange={(e) => patch('value', e.target.value)} /></label>
            <label className="pp-field">Unit<input className="pp-input" value={form.unit} onChange={(e) => patch('unit', e.target.value)} placeholder="mm" /></label>
            <label className="pp-field">Period start<input className="pp-input" type="date" value={form.periodStart} onChange={(e) => patch('periodStart', e.target.value)} /></label>
            <label className="pp-field">Period end<input className="pp-input" type="date" value={form.periodEnd} onChange={(e) => patch('periodEnd', e.target.value)} /></label>
          </div>
          <label className="pp-field">Source name<input className="pp-input" value={form.sourceLabel} onChange={(e) => patch('sourceLabel', e.target.value)} placeholder="e.g. County meteorological bulletin, week 44" /></label>
          <label className="pp-field">Source link (optional, https)<input className="pp-input" inputMode="url" value={form.sourceUri} onChange={(e) => patch('sourceUri', e.target.value)} /></label>
          {formError && <Notice tone="danger" label="Check this:">{formError}</Notice>}
          {save.error && <Notice tone="danger" label="Not saved:">{save.error}</Notice>}
          {notice && !formError && !save.error && <Notice tone="success" label="Saved:">{notice}</Notice>}
          <div><Button type="submit" disabled={save.busy}>{save.busy ? 'Saving…' : 'Save observation'}</Button></div>
        </form>
      </section>
    </div>
  );
}
