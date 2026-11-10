import type { BarRow, SlaRow } from '../../data/chartData';
import {
  FUNNEL_STAGES, NOTIFY_TARGET_HOURS, RESPOND_TARGET_HOURS, parseSevenOneSeven, parseWeeklyReview
} from '../../data/apiCharts';
import { hoursText } from '../../data/derive';
import { BarList } from './BarList';
import { ChartCard } from './ChartCard';
import { SlaBars } from './SlaBars';

const day = (iso: string) => iso.slice(0, 10);

/** Weekly review: for each district, how far this week's signals got through the response chain. Live API data. */
export function WeeklyReviewCharts({ payload }: { payload: unknown }) {
  const data = parseWeeklyReview(payload);
  if (!data) return <p className="pp-hint">The weekly review response was not in the expected format, so no chart was drawn. The raw payload is below.</p>;
  if (data.districts.length === 0) {
    return <p className="pp-hint">No district had enough signals this week to show. Areas with fewer than {data.minCell} signals are hidden to protect privacy.</p>;
  }
  const period = data.weekStart ? `${day(data.weekStart)} to ${day(data.weekEnd)}` : 'this week';
  return (
    <ChartCard id="wk" title="How far each district's signals got" csvName="weekly-review-by-district.csv"
      subtitle={`${period}. Areas with fewer than ${data.minCell} signals are hidden.`}
      table={{
        columns: ['District', ...FUNNEL_STAGES, 'Unresolved', 'Recurring', 'Blocked', 'Priority'],
        rows: data.districts.map((d) => [d.code, ...d.stages, d.unresolved, d.recurrences, d.blockers, d.priority])
      }}>
      <div className="pp-charts">
        {data.districts.map((d) => {
          const rows: BarRow[] = d.stages.map((value, i) => ({ label: FUNNEL_STAGES[i], value, tone: 'neutral' }));
          return (
            <div key={d.code} className="pp-panel-soft">
              <div className="pp-row-between pp-mb">
                <strong>{d.code}</strong>
                <span className={`pp-severity ${d.priority === 'critical' ? 'critical' : d.priority === 'high' ? 'high' : 'low'}`}>
                  {d.priority === 'routine' ? 'Routine' : d.priority === 'high' ? 'High priority' : 'Critical priority'}
                </span>
              </div>
              <BarList rows={rows} unit={`stages reached in ${d.code}`} />
              <p className="pp-hint">{d.unresolved} unresolved · {d.recurrences} recurring · {d.blockers} blocked</p>
            </div>
          );
        })}
      </div>
      {data.interpretation && <p className="pp-hint">{data.interpretation}</p>}
    </ChartCard>
  );
}

/** 7-1-7 clocks: median hours against the notify (1 day) and respond (7 days) reference targets, plus how many signals have each clock recorded. */
export function SevenOneSevenCharts({ payload }: { payload: unknown }) {
  const d = parseSevenOneSeven(payload);
  if (!d) return <p className="pp-hint">The 7-1-7 response was not in the expected format, so no chart was drawn. The raw payload is below.</p>;

  const timed: SlaRow[] = [];
  if (d.detectionToNotification !== null) timed.push({ id: 'notify', label: 'Detection to notification', area: `median across ${d.notifiedCount} notified signals`, target: NOTIFY_TARGET_HOURS, elapsed: d.detectionToNotification, status: d.detectionToNotification > NOTIFY_TARGET_HOURS ? 'Breached' : 'On Track' });
  if (d.notificationToResponse !== null) timed.push({ id: 'respond', label: 'Notification to response started', area: `median across ${d.responseStartedCount} responses`, target: RESPOND_TARGET_HOURS, elapsed: d.notificationToResponse, status: d.notificationToResponse > RESPOND_TARGET_HOURS ? 'Breached' : 'On Track' });

  const recorded: BarRow[] = [
    { label: 'Signals', value: d.signalCount, tone: 'neutral' },
    { label: 'Notified', value: d.notifiedCount, tone: 'neutral' },
    { label: 'Response started', value: d.responseStartedCount, tone: 'neutral' },
    { label: 'Outcome measured', value: d.measuredOutcomeCount, tone: 'neutral' }
  ];
  const med = (v: number | null) => (v === null ? 'Not recorded' : hoursText(Math.round(v * 10) / 10));

  return (
    <div className="pp-charts two">
      <ChartCard id="clk" title="Response clocks against 7-1-7 targets" subtitle="Median hours. Notify within 1 day (24 h); respond within 7 days (168 h)." csvName="seven-one-seven-clocks.csv"
        table={{
          columns: ['Clock', 'Median hours', 'Reference target hours'],
          rows: [
            ['Detection to notification', med(d.detectionToNotification), NOTIFY_TARGET_HOURS],
            ['Notification to response started', med(d.notificationToResponse), RESPOND_TARGET_HOURS],
            ['Detection to response started', med(d.detectionToResponse), 'none'],
            ['Detection to measured outcome', med(d.detectionToMeasuredOutcome), 'none']
          ]
        }}>
        {timed.length > 0 ? <SlaBars rows={timed} /> : <p className="pp-hint">No notification or response times have been recorded yet, so there is nothing to time.</p>}
      </ChartCard>
      <ChartCard id="clkn" title="How many signals have each clock recorded" subtitle="A clock only exists when someone records the step, so low counts mean the medians rest on few signals." csvName="seven-one-seven-completeness.csv"
        table={{ columns: ['Step', 'Signals'], rows: recorded.map((r) => [r.label, r.value]) }}>
        <BarList rows={recorded} unit="signals with each step recorded" emptyText="No signals in this period." />
      </ChartCard>
    </div>
  );
}
