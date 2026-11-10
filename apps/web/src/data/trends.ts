/** DEMONSTRATION time series. Not read from the API.
 *  Replace with the weekly-review / outcomes endpoints once the district is connected.
 *  Every chart that uses this file shows a "Demonstration data" badge.
 */
export interface DailyCount { date: string; cases: number; deaths: number }
export interface DemoOutbreakSeries { id: string; label: string; days: DailyCount[] }
export interface WeeklyPoint { label: string; value: number }

const DATES = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28',
  '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'];

function series(id: string, label: string, cases: number[], deaths: number[]): DemoOutbreakSeries {
  return { id, label, days: DATES.map((date, i) => ({ date, cases: cases[i], deaths: deaths[i] })) };
}

export const DEMO_OUTBREAK_SERIES: DemoOutbreakSeries[] = [
  series('cholera', 'Cholera — Kasese', [0, 0, 1, 0, 2, 1, 3, 2, 4, 3, 5, 6, 8, 14], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  series('awd', 'Acute watery diarrhoea — Buliisa', [2, 1, 3, 2, 4, 3, 5, 6, 4, 7, 9, 12, 18, 23], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  series('measles', 'Measles — Hoima', [0, 1, 0, 1, 1, 2, 1, 2, 3, 2, 4, 3, 5, 8], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
];

export const DEMO_DETECT_HOURS: WeeklyPoint[] = [
  { label: 'W37', value: 7.1 }, { label: 'W38', value: 6.4 }, { label: 'W39', value: 6.0 }, { label: 'W40', value: 5.9 },
  { label: 'W41', value: 5.2 }, { label: 'W42', value: 5.5 }, { label: 'W43', value: 4.8 }, { label: 'W44', value: 4.2 }
];
export const DEMO_RESPOND_HOURS: WeeklyPoint[] = [
  { label: 'W37', value: 16.5 }, { label: 'W38', value: 15.2 }, { label: 'W39', value: 14.1 }, { label: 'W40', value: 13.8 },
  { label: 'W41', value: 12.9 }, { label: 'W42', value: 12.4 }, { label: 'W43', value: 12.1 }, { label: 'W44', value: 11.8 }
];
/** Illustrative targets for the demo lines only; the real targets come from district configuration. */
export const DEMO_DETECT_TARGET_HOURS = 6;
export const DEMO_RESPOND_TARGET_HOURS = 12;
