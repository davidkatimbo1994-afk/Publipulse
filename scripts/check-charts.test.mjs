import test from 'node:test';
import assert from 'node:assert/strict';

const { csvCell, toCsv } = await import('../apps/web/src/lib/csv.ts');
const { openSignalsBySeverity, casesByDisease, slaRows, niceMax } = await import('../apps/web/src/data/chartData.ts');

test('csv quotes commas, quotes and newlines', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell(null), '');
});

test('csv neutralises spreadsheet formulas in text but leaves numbers alone', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell(-3), '-3');
});

test('toCsv writes a header row and CRLF line endings', () => {
  assert.equal(toCsv(['A', 'B'], [[1, 'x']]), 'A,B\r\n1,x');
});

const sig = (severity, status, disease, cases) => ({ id: disease + cases, disease, severity, status, cases });

test('severity bars count only open signals and always list four levels', () => {
  const rows = openSignalsBySeverity([sig('High', 'Verified', 'A', 1), sig('High', 'Closed', 'B', 1), sig('Low', 'Action Pending', 'C', 1)]);
  assert.deepEqual(rows.map((r) => [r.label, r.value]), [['Critical', 0], ['High', 1], ['Medium', 0], ['Low', 1]]);
});

test('cases by disease are summed and sorted largest first', () => {
  const rows = casesByDisease([sig('High', 'Verified', 'Cholera', 5), sig('High', 'Verified', 'Measles', 8), sig('Low', 'Closed', 'Cholera', 4)]);
  assert.deepEqual(rows.map((r) => [r.label, r.value]), [['Cholera', 9], ['Measles', 8]]);
});

test('sla rows put the furthest-over-target response first', () => {
  const gap = (id, slaHours, elapsedHours) => ({ id, title: id, area: 'x', slaHours, elapsedHours, status: 'On Track' });
  assert.deepEqual(slaRows([gap('a', 10, 5), gap('b', 4, 9)]).map((r) => r.id), ['b', 'a']);
});

test('niceMax rounds up to clean axis values', () => {
  assert.equal(niceMax(14), 20);
  assert.equal(niceMax(23), 50);
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(100), 100);
});

const { parseWeeklyReview, parseSevenOneSeven } = await import('../apps/web/src/data/apiCharts.ts');

const district = { administrativeAreaCode: 'UG-KSE', signalCount: 9, verifiedCount: 7, ownedCount: 6, actedCount: 4, measuredCount: 2, durableCount: 1, unresolvedCount: 5, recurrenceCount: 2, blockerCount: 1, priority: 'high' };

test('weekly review parser reads both the bare summary and the wrapped response body', () => {
  const summary = { weekStart: '2026-10-28T00:00:00Z', weekEnd: '2026-11-04T00:00:00Z', minCell: 5, districts: [district], decisionsNeeded: ['ownership_gaps'], interpretation: 'x' };
  for (const payload of [summary, { scope: 'authenticated_organization', summary }]) {
    const r = parseWeeklyReview(payload);
    assert.deepEqual(r.districts[0].stages, [9, 7, 6, 4, 2, 1]);
    assert.equal(r.districts[0].priority, 'high');
    assert.deepEqual(r.decisionsNeeded, ['ownership_gaps']);
  }
});

test('weekly review parser skips malformed districts and rejects non-reviews', () => {
  const r = parseWeeklyReview({ districts: [district, null, { signalCount: 3 }, { administrativeAreaCode: 'B', signalCount: -4, priority: 'weird' }] });
  assert.equal(r.districts.length, 2);
  assert.deepEqual(r.districts[1].stages, [0, 0, 0, 0, 0, 0]);
  assert.equal(r.districts[1].priority, 'routine');
  assert.equal(parseWeeklyReview({ error: 'nope' }), null);
  assert.equal(parseWeeklyReview(null), null);
});

test('7-1-7 parser keeps unrecorded clocks as null instead of zero', () => {
  const r = parseSevenOneSeven({ summary: { signalCount: 12, notifiedCount: 4, responseStartedCount: 0, measuredOutcomeCount: 0,
    medianHours: { detectionToNotification: 30.5, notificationToResponse: null, detectionToResponse: null, detectionToMeasuredOutcome: null } } });
  assert.equal(r.detectionToNotification, 30.5);
  assert.equal(r.notificationToResponse, null);
  assert.equal(parseSevenOneSeven({ summary: {} }), null);
});
