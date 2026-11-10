import type { NavItem, WorkingArea } from '../../data/types';
export const ALL_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', officerPrimary: true },
  { id: 'signals', label: 'Signals', officerPrimary: true },
  { id: 'gaps', label: 'Action Gaps', officerPrimary: true },
  { id: 'investigations', label: 'Investigations' },
  { id: 'actions', label: 'Response Actions', officerPrimary: true },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'intake', label: 'Community reports' },
  { id: 'costs', label: 'Costs' },
  { id: 'stock', label: 'Stock' },
  { id: 'context', label: 'Context' },
  { id: 'weekly', label: 'Weekly Review' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'interop', label: 'Interoperability' },
  { id: 'settings', label: 'Settings', officerPrimary: true }
];
export const MOBILE_NAV: WorkingArea[] = ['dashboard', 'signals', 'gaps', 'actions', 'settings'];
export const AREA_TITLES: Record<WorkingArea, string> = {
  dashboard: 'Dashboard', signals: 'Signals', gaps: 'Action Gaps', investigations: 'Investigations',
  actions: 'Response Actions', outcomes: 'Outcomes', intake: 'Community Reports', costs: 'Costs', stock: 'Stock', context: 'Context', weekly: 'Weekly Review', intelligence: 'Intelligence',
  interop: 'Interoperability', settings: 'Settings'
};
export const AREA_BLURBS: Record<WorkingArea, string> = {
  dashboard: 'Overall public-health situation and priorities',
  signals: 'Report, receive and review health signals',
  gaps: 'Identify delayed, blocked or unresolved responses',
  investigations: 'Review and verify reported signals',
  actions: 'Assign responsibilities and track progress',
  outcomes: 'Record evidence and measure results',
  intake: 'USSD and SMS reports from the community, waiting for a decision',
  costs: 'What response actions cost, next to what they achieved',
  stock: 'Days of stock left and likely stock-outs',
  context: 'Rainfall, water, prices and other area context around a signal',
  weekly: 'Review performance and make decisions',
  intelligence: 'Identify recurring operational problems',
  interop: 'Manage external health-system connections',
  settings: 'Manage accounts, organizations and preferences'
};

/**
 * How much of each working area is backed by the live API when a session is
 * connected. Used by DataModeBanner so the interface never overstates what is real.
 *  - live-panel: a Connected workspace panel loads real records (administrators)
 *  - submit:     new signals are posted to the API; lists remain demonstration data
 *  - live-only:  no demonstration data; records are read from and written to the connected API
 *  - demo:       demonstration data only
 */
export type LiveSupport = 'live-panel' | 'live-only' | 'submit' | 'demo';
export const AREA_LIVE_SUPPORT: Record<WorkingArea, LiveSupport> = {
  dashboard: 'submit', signals: 'submit', gaps: 'demo', investigations: 'demo', actions: 'demo',
  outcomes: 'live-panel', intake: 'live-only', costs: 'live-only', stock: 'live-only', context: 'live-only', weekly: 'live-panel', intelligence: 'live-panel', interop: 'live-panel', settings: 'demo'
};

/** Short, unambiguous labels for the phone bottom bar. */
export const MOBILE_LABEL: Partial<Record<WorkingArea, string>> = {
  dashboard: 'Home', signals: 'Signals', gaps: 'Gaps', actions: 'Actions', settings: 'Settings'
};
