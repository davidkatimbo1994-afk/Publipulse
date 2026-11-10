import type { SharedCategory, SharedSignalStatus } from './domain-map';
/** Presentation and domain types for the responsive shell.
 *  Server authorization remains the source of truth; role here is UI only.
 */
export type Role = 'officer' | 'admin';
export type WorkingArea =
  | 'dashboard' | 'signals' | 'gaps' | 'investigations' | 'actions'
  | 'outcomes' | 'intake' | 'costs' | 'stock' | 'context' | 'weekly' | 'intelligence' | 'interop' | 'settings';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type SignalStatus =
  | 'Under Investigation' | 'Action Pending' | 'Verified' | 'Response Active' | 'Closed';
export type SyncStatus = 'synced' | 'pending_offline';

export interface HealthSignal {
  id: string; disease: string; location: string; cases: number; deaths: number;
  severity: Severity; status: SignalStatus; reportedAt: string; reporter: string;
  syncStatus: SyncStatus; notes: string;
  /** Mapped to the @publipulse/shared vocabulary (see data/domain-map.ts). */
  sharedStatus?: SharedSignalStatus; category?: SharedCategory;
  /** Set when a report is created in this session, so a retry after a lost response cannot save it twice. */
  clientSubmissionId?: string;
  /** ISO time the signal was observed; kept so a delayed retry does not claim it was observed at sync time. */
  observedAt?: string;
}
export interface ActionGap {
  id: string; title: string; area: string; severity: Severity;
  slaHours: number; elapsedHours: number; owner: string;
  status: 'Breached' | 'Warning' | 'On Track'; cause: string;
  /** Set in this session when someone escalates the gap (demonstration state). */
  escalated?: boolean;
}
export interface ResponseAction {
  id: string; title: string; signalId: string; assignee: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority: 'Critical' | 'High' | 'Medium'; dueDate: string;
}
export interface InteropSystem {
  id: string; name: string; type: string;
  status: 'Connected' | 'Syncing' | 'Degraded' | 'Offline';
  lastSync: string; recordsSynced: number; errorCount: number;
}
export interface NavItem {
  id: WorkingArea; label: string; badge?: number; officerPrimary?: boolean;
}
