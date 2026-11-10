import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rv = await import('../apps/web/src/data/resourceViews.ts');
const src = (p) => readFileSync(fileURLToPath(new URL(`../apps/web/src/${p}`, import.meta.url)), 'utf8');

test('money formats with two decimals and never merges currencies', () => {
  assert.equal(rv.money(1500, 'KES'), '1,500.00 KES');
});

test('cost summary parser skips malformed rows and keeps per-currency totals', () => {
  const rows = rv.parseCostSummary({ actions: [
    { actionId: 'a1', signalId: 's1', title: 'Chlorinate wells', totals: [{ currencyCode: 'KES', costKind: 'actual', amount: 100 }, { currencyCode: 'USD', costKind: 'actual', amount: 5 }, { bad: true }], outcomes: { improved: 2 }, costPerImprovedAssessment: [{ currencyCode: 'KES', amount: 50 }] },
    { title: 'no id' }, null
  ] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].totals.length, 2);
  assert.equal(rows[0].outcomes.improved, 2);
  assert.equal(rows[0].outcomes.worsened, 0);
  assert.deepEqual(rows[0].costPerImproved, [{ currencyCode: 'KES', amount: 50 }]);
  assert.deepEqual(rv.parseCostSummary('nope'), []);
});

test('cost form validation mirrors the API schema', () => {
  const ok = { amount: '10.50', currencyCode: 'KES', incurredOn: '2026-11-01', note: '' };
  assert.equal(rv.validateCostForm(ok, '2026-11-05'), '');
  assert.match(rv.validateCostForm({ ...ok, amount: '10.555' }, '2026-11-05'), /two decimal/);
  assert.match(rv.validateCostForm({ ...ok, amount: '' }, '2026-11-05'), /amount/i);
  assert.match(rv.validateCostForm({ ...ok, currencyCode: 'kes' }, '2026-11-05'), /currency/i);
  assert.match(rv.validateCostForm({ ...ok, incurredOn: '2026-02-31' }, '2026-11-05'), /real date/);
  assert.match(rv.validateCostForm({ ...ok, incurredOn: '2026-12-01' }, '2026-11-05'), /future/);
  assert.match(rv.validateCostForm({ ...ok, note: 'ab' }, '2026-11-05'), /note/i);
});

test('stock forecast sorts most urgent first and counts levels', () => {
  const mk = (area, level, days) => ({ administrativeAreaCode: area, commodityCode: 'ORS', unit: 'sachets', quantityOnHand: 10, lastObservedAt: '2026-11-01T00:00:00Z', level, daysOfStockLeft: days, intervalsUsed: 2, confidence: 'low' });
  const d = rv.parseStockForecast({ series: [mk('B', 'ok', 40), mk('C', 'critical', 3), mk('A', 'critical', 1), mk('D', 'weird', null)], assumptions: { leadTimeDays: 7 } });
  assert.deepEqual(d.series.map((s) => s.areaCode), ['A', 'C', 'D', 'B']);
  assert.equal(d.series[2].level, 'insufficient_data');
  assert.equal(d.leadTimeDays, 7);
  assert.deepEqual(rv.stockLevelCounts(d.series), { critical: 2, warning: 0, ok: 1, insufficient_data: 1 });
});

test('stock draft summary is only carried through, never created here', () => {
  const d = rv.parseStockForecast({ series: [{ administrativeAreaCode: 'A', commodityCode: 'X', level: 'critical', suggestedSignal: { summary: 'Draft text' } }, { administrativeAreaCode: 'B', commodityCode: 'X', level: 'ok', suggestedSignal: null }] });
  assert.equal(d.series[0].draftSummary, 'Draft text');
  assert.equal(d.series[1].draftSummary, null);
});

test('stock form validation', () => {
  const now = new Date('2026-11-05T10:00:00Z');
  const ok = { areaCode: 'KE-01', commodityCode: 'ORS', unit: 'sachets', onHand: '120', received: '', observedAt: '2026-11-05T09:00' };
  assert.equal(rv.validateStockForm(ok, now), '');
  assert.match(rv.validateStockForm({ ...ok, areaCode: 'bad area!' }, now), /Area code/);
  assert.match(rv.validateStockForm({ ...ok, onHand: '-1' }, now), /zero or more/);
  assert.match(rv.validateStockForm({ ...ok, observedAt: '2027-01-01T00:00' }, now), /future/);
  assert.match(rv.validateStockForm({ ...ok, observedAt: '' }, now), /date and time/);
});

test('signal context parser keeps the association-only flag and drops non-https links', () => {
  const c = rv.parseSignalContext({ signalId: 's', administrativeAreaCode: 'A', window: { from: '2026-10-01', to: '2026-11-08' }, interpretation: 'association_in_time_only', causalClaim: false,
    comparisons: [{ metricCode: 'rain', unit: 'mm', windowMean: 80, windowCount: 2, baselineMean: 30, baselineCount: 4, ratio: 2.67, deviation: 'above' }, { metricCode: 'x', deviation: 'invented' }],
    observations: [{ id: 'o1', administrativeAreaCode: 'A', metricCode: 'rain', value: 80, unit: 'mm', periodStart: '2026-10-20', periodEnd: '2026-10-27', sourceLabel: 'Met', sourceUri: 'http://insecure.example' }] });
  assert.equal(c.associationOnly, true);
  assert.equal(c.comparisons[1].deviation, 'insufficient_baseline');
  assert.equal(c.observations[0].sourceUri, null);
  assert.equal(rv.parseSignalContext({ signalId: 's', window: {}, causalClaim: true, interpretation: 'x' }).associationOnly, false);
  assert.equal(rv.parseSignalContext({}), null);
});

test('context form validation mirrors the API schema', () => {
  const ok = { areaCode: 'KE-01', metricCode: 'rainfall_mm', value: '12', unit: 'mm', periodStart: '2026-10-01', periodEnd: '2026-10-07', sourceLabel: 'Met office', sourceUri: '' };
  assert.equal(rv.validateContextForm(ok), '');
  assert.match(rv.validateContextForm({ ...ok, metricCode: 'Rain' }), /Metric code/);
  assert.match(rv.validateContextForm({ ...ok, periodEnd: '2026-09-01' }), /before/);
  assert.match(rv.validateContextForm({ ...ok, periodEnd: '2026-12-01' }), /31 days/);
  assert.match(rv.validateContextForm({ ...ok, sourceUri: 'http://x.org' }), /https/);
  assert.match(rv.validateContextForm({ ...ok, sourceUri: 'https://u:p@x.org' }), /https/);
  assert.match(rv.validateContextForm({ ...ok, sourceLabel: ' ' }), /source/i);
});

test('the three areas read live records only and reuse one mutation id per distinct entry', () => {
  for (const f of ['CostsView', 'StockView', 'ContextView']) {
    const s = src(`areas/${f}.tsx`);
    assert.doesNotMatch(s, /fixtures|demo-cases|INITIAL_/, `${f} must not use demonstration data`);
    assert.match(s, /NeedsConnection/, `${f} must explain when nothing is connected`);
    assert.match(s, /useMutationId/, `${f} must make retries safe`);
    assert.doesNotMatch(s, /localStorage|sessionStorage|indexedDB/i, `${f} must not persist anything`);
    assert.doesNotMatch(s, /style=\{\{/, `${f} must not use inline styles`);
  }
});

test('stock screen never submits a signal on its own', () => {
  const s = src('areas/StockView.tsx');
  assert.doesNotMatch(s, /submitSignal|reportSignal/);
  assert.match(s, /Copy draft/);
});

test('cost screen states cost per improved assessment is not cost per life saved', () => {
  assert.match(src('areas/CostsView.tsx'), /not cost per life saved/i);
});

test('context screen states association only and has no cause wording', () => {
  const s = src('areas/ContextView.tsx');
  assert.match(s, /Association in time only/);
  assert.doesNotMatch(s, /caused by|because of|due to/i);
});

test('new areas are registered in the shell and the live-support map', () => {
  const nav = src('components/layout/navConfig.ts');
  for (const id of ['costs', 'stock', 'context']) {
    assert.match(nav, new RegExp(`id: '${id}'`));
    assert.match(nav, new RegExp(`${id}: 'live-only'`));
  }
  const app = src('App.tsx');
  assert.match(app, /case 'costs'/); assert.match(app, /case 'stock'/); assert.match(app, /case 'context'/);
});

const tv = await import('../apps/web/src/data/teamViews.ts');

test('team parsers keep valid rows and ignore malformed ones', () => {
  const m = tv.parseMembers({ members: [{ userId: 'u1', role: 'analyst', active: true, createdAt: '2026-11-01T00:00:00Z' }, { role: 'x' }, null], assignableRoles: ['analyst', 5] });
  assert.equal(m.members.length, 1);
  assert.deepEqual(m.assignableRoles, ['analyst']);
  assert.deepEqual(tv.parseMembers('x'), { members: [], assignableRoles: [] });
  const i = tv.parseInvitations({ invitations: [{ id: 'i1', role: 'responder', status: 'weird', createdAt: 'a', expiresAt: 'b' }, { id: 2 }] });
  assert.equal(i.length, 1);
  assert.equal(i[0].status, 'pending');
});

test('a created invitation is only accepted with a well-formed one-time code', () => {
  const code = 'ppi_' + 'A1_-'.repeat(10) + 'abc';
  assert.equal(code.length, 47);
  assert.equal(tv.parseCreatedInvitation({ code, invitation: { role: 'analyst', expiresAt: 'x' } }).code, code);
  assert.equal(tv.parseCreatedInvitation({ code: 'short', invitation: {} }), null);
  assert.equal(tv.normalizeInviteCode(`  ${code}\n`), code);
  assert.equal(tv.normalizeInviteCode('ppi_tooshort'), null);
});

test('team error codes become plain language and unknown codes pass through', () => {
  assert.match(tv.teamErrorText('last_owner_required'), /at least one active owner/);
  assert.match(tv.teamErrorText('invitation_invalid'), /wrong, used, expired or withdrawn/);
  assert.equal(tv.teamErrorText('something_else'), 'something_else');
});

test('the live team panel never stores the invitation code and is only mounted for a live session', () => {
  const s = src('areas/LiveTeamPanel.tsx');
  assert.doesNotMatch(s, /localStorage|sessionStorage|indexedDB/i);
  assert.match(s, /will not be shown again/);
  const settings = src('areas/SettingsView.tsx');
  assert.match(settings, /sessionApiConfig && <LiveTeamPanel \/>/);
  assert.match(settings, /!sessionApiConfig && \(/);
});

const cv = await import('../apps/web/src/data/communityViews.ts');

test('community queue parser keeps valid rows, defaults unknown values, and ignores malformed ones', () => {
  const rows = cv.parseQueue({ items: [{ id: 'a', channel: 'sms', category: 'supply_gap', areaCode: 'KE-A', narrative: 'x', urgent: true, receivedAt: '2026-11-05T10:00:00Z', decision: null }, { id: 'b', channel: 'weird', decision: 'odd' }, { nope: 1 }, null] });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].urgent, true);
  assert.equal(rows[1].channel, 'ussd');
  assert.equal(rows[1].decision, null);
  assert.deepEqual(cv.parseQueue('x'), []);
  assert.equal(cv.parseStats({}), null);
  assert.equal(cv.parseStats({ stats: { pending: 3, urgentPending: 1, oldestPendingHours: 30, reviewedLast30Days: 2, medianHoursToReview: null } }).pending, 3);
});

test('queue age is shown in plain words', () => {
  assert.equal(cv.ageText(null), '—');
  assert.equal(cv.ageText(0.4), 'under 1 h');
  assert.equal(cv.ageText(30), '30 h');
  assert.equal(cv.ageText(52), '2 days 4 h');
  assert.equal(cv.categoryLabel('water_sanitation'), 'Water or sanitation problem');
  assert.equal(cv.categoryLabel('new_thing'), 'new_thing');
});

test('review form checks mirror the server rules', () => {
  const base = { decision: 'promote', summary: '', signalId: '', reason: '' };
  assert.equal(cv.validateReview(base), '');
  assert.match(cv.validateReview({ ...base, summary: 'short' }), /10 to 1000/);
  assert.match(cv.validateReview({ ...base, decision: 'merge', signalId: 'abc' }), /ID of the existing signal/);
  assert.equal(cv.validateReview({ ...base, decision: 'merge', signalId: '66666666-6666-4666-8666-666666666666' }), '');
  assert.match(cv.validateReview({ ...base, decision: 'dismiss', reason: 'no' }), /why/);
  assert.equal(cv.validateReview({ ...base, decision: 'dismiss', reason: 'Not a health event' }), '');
  assert.match(cv.reviewErrorText('already_reviewed'), /already decided/);
});

test('community screen is live-only, never stores anything, and says a decision is final', () => {
  const s = src('areas/CommunityIntakeView.tsx');
  assert.match(s, /NeedsConnection/);
  assert.match(s, /final and cannot be edited/);
  assert.doesNotMatch(s, /localStorage|sessionStorage|indexedDB/i);
  assert.match(src('components/layout/navConfig.ts'), /intake: 'live-only'/);
  assert.match(src('App.tsx'), /case 'intake'/);
});

test('a dropped connection is shown in plain words on the live screens', () => {
  assert.match(src('areas/resource-shared.tsx'), /Could not reach the server/);
});
