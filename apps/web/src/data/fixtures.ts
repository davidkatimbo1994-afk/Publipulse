import type { ActionGap, HealthSignal, InteropSystem, ResponseAction } from './types';

export const INITIAL_SIGNALS: HealthSignal[] = [
  { id: 'SIG-2026-089', disease: 'Cholera Cluster', location: 'Kasese District, Ward 3', cases: 14, deaths: 1, severity: 'High', status: 'Under Investigation', reportedAt: '2026-11-04 08:30', reporter: 'Officer J. Tumusiime', syncStatus: 'synced', notes: 'Unprotected well identified near outbreak epicenter.', sharedStatus: 'investigating', category: 'unusual_illness' },
  { id: 'SIG-2026-088', disease: 'Viral Hemorrhagic Fever (Suspected)', location: 'Bundibugyo Border Point', cases: 2, deaths: 1, severity: 'Critical', status: 'Action Pending', reportedAt: '2026-11-04 07:15', reporter: 'Nurse M. Akello', syncStatus: 'synced', notes: 'Patient presented with sudden fever and bleeding. Isolated.', sharedStatus: 'under_review', category: 'unusual_illness' },
  { id: 'SIG-2026-087', disease: 'Measles Outbreak', location: 'Hoima Municipality', cases: 8, deaths: 0, severity: 'Medium', status: 'Verified', reportedAt: '2026-11-03 16:45', reporter: 'Dr. K. Mugisha', syncStatus: 'synced', notes: 'Low vaccination coverage reported in neighboring settlements.', sharedStatus: 'verified', category: 'unusual_illness' },
  { id: 'SIG-2026-086', disease: 'Acute Watery Diarrhea', location: 'Buliisa Fishing Village', cases: 23, deaths: 0, severity: 'High', status: 'Response Active', reportedAt: '2026-11-03 11:20', reporter: 'Field Tech S. Opio', syncStatus: 'synced', notes: 'Water sampling underway along lake shore.', sharedStatus: 'investigating', category: 'environmental_hazard' },
  { id: 'SIG-2026-085', disease: 'Typhoid Spike', location: 'Fort Portal West', cases: 6, deaths: 0, severity: 'Low', status: 'Closed', reportedAt: '2026-11-02 14:10', reporter: 'Officer J. Tumusiime', syncStatus: 'synced', notes: 'Chlorination tabs distributed. Case trend resolved.', sharedStatus: 'closed', category: 'unusual_illness' }
];

export const INITIAL_GAPS: ActionGap[] = [
  { id: 'GAP-402', title: 'Delayed Sample Cold-Chain Transport', area: 'Bundibugyo Border', severity: 'Critical', slaHours: 4, elapsedHours: 9.5, owner: 'Logistics Desk', status: 'Breached', cause: 'Vehicle shortage during shift handover' },
  { id: 'GAP-398', title: 'Water Purification Tablet Stockout', area: 'Kasese Ward 3', severity: 'High', slaHours: 12, elapsedHours: 14.2, owner: 'Supply Chain Unit', status: 'Breached', cause: 'Warehouse inventory disalignment' },
  { id: 'GAP-395', title: 'Contact Tracing Staffing Shortage', area: 'Hoima Municipality', severity: 'Medium', slaHours: 24, elapsedHours: 18.0, owner: 'District HR', status: 'Warning', cause: 'Staff reassigned to routine immunization' }
];

export const INITIAL_ACTIONS: ResponseAction[] = [
  { id: 'ACT-109', title: 'Deploy Rapid Response Team (RRT)', signalId: 'SIG-2026-088', assignee: 'RRT Alpha Team', status: 'In Progress', priority: 'Critical', dueDate: '2026-11-04' },
  { id: 'ACT-108', title: 'Distribute 500 AquaTabs & Clean Water Kits', signalId: 'SIG-2026-089', assignee: 'WASH Taskforce', status: 'Completed', priority: 'High', dueDate: '2026-11-04' },
  { id: 'ACT-107', title: 'Setup Ring Vaccination Drive', signalId: 'SIG-2026-087', assignee: 'Immunization Unit', status: 'Pending', priority: 'Medium', dueDate: '2026-11-06' },
  { id: 'ACT-106', title: 'Conduct Household Disinfection', signalId: 'SIG-2026-086', assignee: 'Community Health Team', status: 'In Progress', priority: 'High', dueDate: '2026-11-05' }
];

export const INITIAL_INTEROP_SYSTEMS: InteropSystem[] = [
  { id: 'sys-1', name: 'National DHIS2 Endpoint', type: 'DHIS2 v2.40', status: 'Connected', lastSync: '10 mins ago', recordsSynced: 14290, errorCount: 0 },
  { id: 'sys-2', name: 'Regional FHIR Repository', type: 'HL7 FHIR R4', status: 'Syncing', lastSync: 'In progress', recordsSynced: 3120, errorCount: 2 },
  { id: 'sys-3', name: 'WHO EWARS Gateway', type: 'REST API', status: 'Connected', lastSync: '1 hour ago', recordsSynced: 940, errorCount: 0 },
  { id: 'sys-4', name: 'Central Lab LIMS', type: 'HL7 v2.x', status: 'Degraded', lastSync: '4 hours ago', recordsSynced: 8410, errorCount: 14 }
];
