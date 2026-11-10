import type { DemoCase } from './types';

export const initialCases: DemoCase[] = [
  { id: 'PP-DEMO-104', title: 'Repeated fever reports near a water point', district: 'Demo District A', createdAt: '2026-10-09T08:00:00Z', stage: 'investigation', status: 'blocked', owner: 'District surveillance desk', verifiedAt: '2026-10-10T09:00:00Z', dueAt: '2026-10-11T09:00:00Z', blocker: 'Water-quality sample collection pending', outcomeEvidence: '', evidenceQuality: 'reviewed', recurrences: 2 },
  { id: 'PP-DEMO-108', title: 'Community report awaiting verification', district: 'Demo District B', createdAt: '2026-10-09T06:00:00Z', stage: 'signal', status: 'open', owner: '', verifiedAt: null, dueAt: null, blocker: '', outcomeEvidence: '', evidenceQuality: 'preliminary', recurrences: 0 },
  { id: 'PP-DEMO-097', title: 'Response task past its review date', district: 'Demo District C', createdAt: '2026-10-06T10:00:00Z', stage: 'response', status: 'in_progress', owner: 'Facility response lead', verifiedAt: '2026-10-06T12:00:00Z', dueAt: '2026-10-10T12:00:00Z', blocker: '', outcomeEvidence: '', evidenceQuality: 'reviewed', recurrences: 0 },
  { id: 'PP-DEMO-091', title: 'Completed response needs follow-up measurement', district: 'Demo District A', createdAt: '2026-10-04T08:00:00Z', stage: 'response', status: 'completed', owner: 'District review team', verifiedAt: '2026-10-04T10:00:00Z', dueAt: '2026-10-08T10:00:00Z', blocker: '', outcomeEvidence: '', evidenceQuality: 'reviewed', recurrences: 1 },
  { id: 'PP-DEMO-112', title: 'Conflicting reports require corroboration', district: 'Demo District D', createdAt: '2026-10-12T05:00:00Z', stage: 'investigation', status: 'open', owner: 'Authorized investigator', verifiedAt: null, dueAt: '2026-10-14T05:00:00Z', blocker: '', outcomeEvidence: '', evidenceQuality: 'conflicting', recurrences: 0 }
];

export const fixedNow = Date.parse('2026-10-12T08:00:00Z');
