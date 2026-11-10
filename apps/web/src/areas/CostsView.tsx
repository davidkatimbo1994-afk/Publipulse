import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, Notice } from '../components/ui';
import { downloadCsv, toCsv } from '../lib/csv';
import { loadActionCosts, loadCostSummary, recordActionCost } from '../lib/api-client';
import { money, parseActionCosts, parseCostSummary, validateCostForm } from '../data/resourceViews';
import type { ActionCostsData, CostSummaryRow } from '../data/resourceViews';
import { NeedsConnection, todayIso, useLiveConfig, useMutationId, useRunner } from './resource-shared';

const CATEGORIES = ['personnel', 'supplies', 'transport', 'laboratory', 'communication', 'training', 'infrastructure', 'other'] as const;

function totalsText(row: CostSummaryRow, kind: 'planned' | 'actual'): string {
  const parts = row.totals.filter((t) => t.costKind === kind).map((t) => money(t.amount, t.currencyCode));
  return parts.length ? parts.join(' · ') : '—';
}

export function CostsView() {
  const cfg = useLiveConfig();
  const list = useRunner();
  const detail = useRunner();
  const save = useRunner();
  const mutation = useMutationId();
  const [rows, setRows] = useState<CostSummaryRow[] | null>(null);
  const [selected, setSelected] = useState<CostSummaryRow | null>(null);
  const [costs, setCosts] = useState<ActionCostsData | null>(null);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ costKind: 'actual', costCategory: 'supplies', amount: '', currencyCode: '', incurredOn: todayIso(), note: '' });
  const [formError, setFormError] = useState('');
  const patch = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  if (!cfg) return <NeedsConnection what="Action costs" />;

  const loadList = () => list.run(async () => {
    setRows(parseCostSummary(await loadCostSummary(cfg)));
  });

  const open = (row: CostSummaryRow) => {
    setSelected(row); setNotice(''); setFormError('');
    return detail.run(async () => { setCosts(parseActionCosts(await loadActionCosts(cfg, row.actionId))); });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const problem = validateCostForm(form, todayIso());
    if (problem) { setFormError(problem); return; }
    setFormError(''); setNotice('');
    const body = {
      costKind: form.costKind as 'planned' | 'actual', costCategory: form.costCategory, amount: Number(form.amount),
      currencyCode: form.currencyCode.trim(), incurredOn: form.incurredOn, ...(form.note.trim() ? { note: form.note.trim() } : {})
    };
    const ok = await save.run(async () => {
      const result = await recordActionCost(cfg, selected.actionId, body, mutation.idFor(`${selected.actionId}|${JSON.stringify(body)}`));
      setNotice(result.replayed === true ? 'That entry was already saved; nothing was added twice.' : 'Cost entry saved. Entries cannot be edited or deleted.');
    });
    if (ok) {
      mutation.done();
      setForm((p) => ({ ...p, amount: '', note: '' }));
      await detail.run(async () => { setCosts(parseActionCosts(await loadActionCosts(cfg, selected.actionId))); });
      await list.run(async () => { setRows(parseCostSummary(await loadCostSummary(cfg))); });
    }
  };

  const exportCsv = () => {
    if (!rows) return;
    downloadCsv('action-costs-summary.csv', toCsv(
      ['Action', 'Planned', 'Actual', 'Improved', 'No change', 'Worsened', 'Inconclusive', 'Actual cost per improved assessment'],
      rows.map((r) => [r.title, totalsText(r, 'planned'), totalsText(r, 'actual'), r.outcomes.improved, r.outcomes.no_change, r.outcomes.worsened, r.outcomes.inconclusive,
        r.costPerImproved.length ? r.costPerImproved.map((p) => money(p.amount, p.currencyCode)).join(' · ') : '—'])
    ));
  };

  return (
    <div>
      <section className="pp-card pp-mb" aria-labelledby="costs-summary-title">
        <div className="pp-row-wrap-between pp-mb">
          <div>
            <h3 id="costs-summary-title" className="pp-title-sm">Cost of response actions</h3>
            <p className="pp-hint">Planned and actual spending per action, next to what the outcome assessments found.</p>
          </div>
          <div className="pp-row-wrap">
            <Button onClick={() => void loadList()} disabled={list.busy}>{list.busy ? 'Loading…' : rows ? 'Refresh' : 'Load costs'}</Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!rows || rows.length === 0}>Download CSV</Button>
          </div>
        </div>
        <Notice tone="info" label="How to read this:">
          Cost per improved assessment is actual spending divided by assessments recorded as improved. It is not cost per life saved, and currencies are never added together.
        </Notice>
        {list.error && <Notice tone="danger" label="Could not load:">{list.error}</Notice>}
        {rows === null && !list.error && <EmptyState title="Nothing loaded yet" hint="Choose Load costs to read this organisation's cost records." />}
        {rows !== null && rows.length === 0 && <EmptyState title="No actions with cost data" hint="Costs are recorded against a response action once it exists." />}
        {rows !== null && rows.length > 0 && (
          <div className="pp-table-wrap pp-mt-sm" tabIndex={0} role="region" aria-label="Action costs, scrolls sideways on small screens">
            <table className="pp-table">
              <caption className="pp-sr-only">Cost and outcome summary per response action</caption>
              <thead><tr>
                <th scope="col">Action</th><th scope="col">Planned</th><th scope="col">Actual</th>
                <th scope="col">Outcomes (improved / no change / worse / unclear)</th><th scope="col">Actual cost per improved</th><th scope="col"><span className="pp-sr-only">Open</span></th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.actionId}>
                    <td className="pp-strong">{r.title}</td>
                    <td>{totalsText(r, 'planned')}</td>
                    <td>{totalsText(r, 'actual')}</td>
                    <td>{r.outcomes.improved} / {r.outcomes.no_change} / {r.outcomes.worsened} / {r.outcomes.inconclusive}</td>
                    <td>{r.costPerImproved.length ? r.costPerImproved.map((p) => money(p.amount, p.currencyCode)).join(' · ') : 'No improved assessment yet'}</td>
                    <td><Button variant="secondary" onClick={() => void open(r)} aria-label={`Open costs for ${r.title}`}>Open</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="pp-card pp-mb" aria-labelledby="costs-detail-title">
          <h3 id="costs-detail-title" className="pp-title-sm">{selected.title}</h3>
          {detail.error && <Notice tone="danger" label="Could not load entries:">{detail.error}</Notice>}
          {detail.busy && <p className="pp-hint">Loading entries…</p>}
          {costs && costs.entries.length === 0 && !detail.busy && <EmptyState title="No cost entries yet" hint="Use the form below to add the first one." />}
          {costs && costs.entries.length > 0 && (
            <div className="pp-table-wrap pp-mt-sm" tabIndex={0} role="region" aria-label="Cost entries, scrolls sideways on small screens">
              <table className="pp-table">
                <caption className="pp-sr-only">Cost entries for this action</caption>
                <thead><tr><th scope="col">Date</th><th scope="col">Kind</th><th scope="col">Category</th><th scope="col">Amount</th><th scope="col">Note</th></tr></thead>
                <tbody>
                  {costs.entries.map((c) => (
                    <tr key={c.id}><td>{c.incurredOn}</td><td>{c.costKind}</td><td>{c.costCategory}</td><td>{money(c.amount, c.currencyCode)}</td><td>{c.note || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 className="pp-title-sm pp-mt-sm">Add a cost entry</h4>
          <p className="pp-hint">Entries are permanent. Do not enter names or phone numbers in the note.</p>
          <form className="pp-stack-sm" onSubmit={(e) => void submit(e)} noValidate>
            <div className="pp-grid-2">
              <label className="pp-field">Kind
                <select className="pp-input" value={form.costKind} onChange={(e) => patch('costKind', e.target.value)}>
                  <option value="actual">Actual (money spent)</option><option value="planned">Planned (budgeted)</option>
                </select>
              </label>
              <label className="pp-field">Category
                <select className="pp-input" value={form.costCategory} onChange={(e) => patch('costCategory', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="pp-field">Amount
                <input className="pp-input" inputMode="decimal" value={form.amount} onChange={(e) => patch('amount', e.target.value)} placeholder="1500.00" />
              </label>
              <label className="pp-field">Currency (3 letters)
                <input className="pp-input" value={form.currencyCode} maxLength={3} onChange={(e) => patch('currencyCode', e.target.value.toUpperCase())} placeholder="KES" />
              </label>
              <label className="pp-field">Date of cost
                <input className="pp-input" type="date" max={todayIso()} value={form.incurredOn} onChange={(e) => patch('incurredOn', e.target.value)} />
              </label>
            </div>
            <label className="pp-field">Note (optional)
              <textarea className="pp-input" rows={2} maxLength={500} value={form.note} onChange={(e) => patch('note', e.target.value)} />
            </label>
            {formError && <Notice tone="danger" label="Check this:">{formError}</Notice>}
            {save.error && <Notice tone="danger" label="Not saved:">{save.error}</Notice>}
            {notice && !formError && !save.error && <Notice tone="success" label="Saved:">{notice}</Notice>}
            <div><Button type="submit" disabled={save.busy}>{save.busy ? 'Saving…' : 'Save cost entry'}</Button></div>
          </form>
        </section>
      )}
    </div>
  );
}
