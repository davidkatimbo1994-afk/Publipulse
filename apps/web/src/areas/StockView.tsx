import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, Notice } from '../components/ui';
import { downloadCsv, toCsv } from '../lib/csv';
import { loadStockForecast, recordStockSnapshot } from '../lib/api-client';
import { LEVEL_LABEL, parseStockForecast, stockLevelCounts, validateStockForm } from '../data/resourceViews';
import type { StockForecastData, StockLevel, StockSeriesRow } from '../data/resourceViews';
import { NeedsConnection, useLiveConfig, useMutationId, useRunner } from './resource-shared';

const LEVEL_MARK: Record<StockLevel, string> = { critical: '!!', warning: '!', ok: '✓', insufficient_data: '?' };

function LevelChip({ level }: { level: StockLevel }) {
  return <span className={`pp-level ${level}`}><span aria-hidden="true">{LEVEL_MARK[level]}</span> {LEVEL_LABEL[level]}</span>;
}

function localNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function StockView() {
  const cfg = useLiveConfig();
  const load = useRunner();
  const save = useRunner();
  const mutation = useMutationId();
  const [lead, setLead] = useState('7');
  const [data, setData] = useState<StockForecastData | null>(null);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ areaCode: '', commodityCode: '', unit: '', onHand: '', received: '', observedAt: localNow() });
  const patch = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  if (!cfg) return <NeedsConnection what="Stock levels" />;

  const leadDays = Number(lead);
  const leadOk = Number.isInteger(leadDays) && leadDays >= 1 && leadDays <= 180;

  const refresh = () => load.run(async () => {
    if (!leadOk) throw new Error('Resupply lead time must be a whole number of days from 1 to 180.');
    setData(parseStockForecast(await loadStockForecast(cfg, leadDays)));
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateStockForm(form, new Date());
    if (problem) { setFormError(problem); return; }
    setFormError(''); setNotice('');
    const body = {
      administrativeAreaCode: form.areaCode.trim(), commodityCode: form.commodityCode.trim(), unit: form.unit.trim(),
      quantityOnHand: Number(form.onHand), quantityReceived: form.received.trim() === '' ? 0 : Number(form.received),
      observedAt: new Date(form.observedAt).toISOString()
    };
    const ok = await save.run(async () => {
      const result = await recordStockSnapshot(cfg, body, mutation.idFor(JSON.stringify(body)));
      setNotice(result.replayed === true ? 'That count was already saved; nothing was added twice.' : 'Stock count saved. Counts cannot be edited or deleted.');
    });
    if (ok) {
      mutation.done();
      setForm((p) => ({ ...p, onHand: '', received: '', observedAt: localNow() }));
      if (leadOk) await load.run(async () => { setData(parseStockForecast(await loadStockForecast(cfg, leadDays))); });
    }
  };

  const copyDraft = async (row: StockSeriesRow) => {
    if (!row.draftSummary) return;
    try { await navigator.clipboard.writeText(row.draftSummary); setCopied(`${row.areaCode}|${row.commodityCode}`); }
    catch { setCopied(''); load.setError('Copying is not available here. Select the draft text and copy it by hand.'); }
  };

  const exportCsv = () => {
    if (!data) return;
    downloadCsv('stock-forecast.csv', toCsv(
      ['Area', 'Commodity', 'Unit', 'On hand', 'Last counted', 'Level', 'Per day', 'Days left', 'Projected stock-out', 'Confidence', 'Intervals used', 'Skipped intervals'],
      data.series.map((s) => [s.areaCode, s.commodityCode, s.unit, s.quantityOnHand, s.lastObservedAt, LEVEL_LABEL[s.level], s.dailyConsumption, s.daysOfStockLeft, s.projectedStockoutOn, s.confidence, s.intervalsUsed, s.inconsistentIntervals])
    ));
  };

  const counts = data ? stockLevelCounts(data.series) : null;

  return (
    <div>
      <section className="pp-card pp-mb" aria-labelledby="stock-forecast-title">
        <div className="pp-row-wrap-between pp-mb">
          <div>
            <h3 id="stock-forecast-title" className="pp-title-sm">Stock forecast</h3>
            <p className="pp-hint">How many days of each commodity are left, worked out from consecutive stock counts.</p>
          </div>
          <div className="pp-row-wrap">
            <label className="pp-field">Resupply lead time (days)
              <input className="pp-input" inputMode="numeric" value={lead} onChange={(e) => setLead(e.target.value)} aria-invalid={!leadOk} />
            </label>
            <Button onClick={() => void refresh()} disabled={load.busy}>{load.busy ? 'Loading…' : data ? 'Refresh' : 'Load forecast'}</Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!data || data.series.length === 0}>Download CSV</Button>
          </div>
        </div>
        <Notice tone="info" label="Limits:">
          Assumes steady use. Deliveries still on the way are not counted. Intervals where stock rose with no receipt recorded are skipped. A count older than 30 days gives no forecast.
          Critical means stock may run out within the lead time; warning means within twice that.
        </Notice>
        {load.error && <Notice tone="danger" label="Could not load:">{load.error}</Notice>}

        {counts && (
          <div className="pp-metric-grid pp-mt-sm">
            {(['critical', 'warning', 'ok', 'insufficient_data'] as const).map((l) => (
              <div key={l} className="pp-metric-card pp-passive"><p className="label">{LEVEL_LABEL[l]}</p><p className="value">{counts[l]}</p><p className="sub">stock series</p></div>
            ))}
          </div>
        )}

        {data === null && !load.error && <EmptyState title="Nothing loaded yet" hint="Choose Load forecast, or record a first stock count below." />}
        {data !== null && data.series.length === 0 && <EmptyState title="No stock counts recorded" hint="Record at least two counts of the same commodity in the same area to get a forecast." />}
        {data !== null && data.series.length > 0 && (
          <div className="pp-table-wrap pp-mt-sm" tabIndex={0} role="region" aria-label="Stock forecast, scrolls sideways on small screens">
            <table className="pp-table">
              <caption className="pp-sr-only">Forecast per area and commodity, most urgent first</caption>
              <thead><tr>
                <th scope="col">Area</th><th scope="col">Commodity</th><th scope="col">Level</th><th scope="col">On hand</th><th scope="col">Days left</th>
                <th scope="col">Projected stock-out</th><th scope="col">Per day</th><th scope="col">Basis</th>
              </tr></thead>
              <tbody>
                {data.series.map((s) => {
                  const key = `${s.areaCode}|${s.commodityCode}`;
                  return (
                    <tr key={key}>
                      <td className="pp-strong">{s.areaCode}</td>
                      <td>{s.commodityCode}</td>
                      <td><LevelChip level={s.level} /></td>
                      <td>{s.quantityOnHand.toLocaleString('en-GB')} {s.unit}</td>
                      <td>{s.daysOfStockLeft === null ? '—' : s.daysOfStockLeft}</td>
                      <td>{s.projectedStockoutOn ?? '—'}</td>
                      <td>{s.dailyConsumption === null ? '—' : s.dailyConsumption}</td>
                      <td>
                        {s.stale ? 'Last count is over 30 days old' : `${s.intervalsUsed} interval${s.intervalsUsed === 1 ? '' : 's'}, ${s.confidence} confidence`}
                        {s.inconsistentIntervals > 0 ? `; ${s.inconsistentIntervals} skipped` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data && data.series.some((s) => s.draftSummary) && (
        <section className="pp-card pp-mb" aria-labelledby="stock-drafts-title">
          <h3 id="stock-drafts-title" className="pp-title-sm">Drafts for a possible service-disruption signal</h3>
          <p className="pp-hint">Nothing is submitted for you. Copy a draft, check it against what you know on the ground, then report it as a signal yourself.</p>
          <ul className="pp-stack-sm">
            {data.series.filter((s) => s.draftSummary).map((s) => (
              <li key={`${s.areaCode}|${s.commodityCode}`} className="pp-row-wrap-between">
                <span>{s.draftSummary}</span>
                <Button variant="secondary" onClick={() => void copyDraft(s)}>{copied === `${s.areaCode}|${s.commodityCode}` ? 'Copied' : 'Copy draft'}</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pp-card pp-mb" aria-labelledby="stock-record-title">
        <h3 id="stock-record-title" className="pp-title-sm">Record a stock count</h3>
        <p className="pp-hint">Counts of items only. Never enter patient or dispensing details. Counts are permanent.</p>
        <form className="pp-stack-sm" onSubmit={(e) => void submit(e)} noValidate>
          <div className="pp-grid-2">
            <label className="pp-field">Area code
              <input className="pp-input" value={form.areaCode} onChange={(e) => patch('areaCode', e.target.value)} placeholder="e.g. KE-NAIROBI-03" />
            </label>
            <label className="pp-field">Commodity code
              <input className="pp-input" value={form.commodityCode} onChange={(e) => patch('commodityCode', e.target.value)} placeholder="e.g. ORS-SACHET" />
            </label>
            <label className="pp-field">Unit
              <input className="pp-input" value={form.unit} onChange={(e) => patch('unit', e.target.value)} placeholder="e.g. sachets" />
            </label>
            <label className="pp-field">Counted at
              <input className="pp-input" type="datetime-local" value={form.observedAt} onChange={(e) => patch('observedAt', e.target.value)} />
            </label>
            <label className="pp-field">On hand now
              <input className="pp-input" inputMode="decimal" value={form.onHand} onChange={(e) => patch('onHand', e.target.value)} />
            </label>
            <label className="pp-field">Received since last count (blank = none)
              <input className="pp-input" inputMode="decimal" value={form.received} onChange={(e) => patch('received', e.target.value)} />
            </label>
          </div>
          {formError && <Notice tone="danger" label="Check this:">{formError}</Notice>}
          {save.error && <Notice tone="danger" label="Not saved:">{save.error}</Notice>}
          {notice && !formError && !save.error && <Notice tone="success" label="Saved:">{notice}</Notice>}
          <div><Button type="submit" disabled={save.busy}>{save.busy ? 'Saving…' : 'Save stock count'}</Button></div>
        </form>
      </section>
    </div>
  );
}
