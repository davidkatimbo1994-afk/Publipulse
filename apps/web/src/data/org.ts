/** Demonstration organisation data for Settings, Weekly Review and Outcomes.
 *  Role names match the roles the API enforces (organization_memberships.role).
 *  The server is the source of truth for permissions; this matrix is a readable summary of it.
 */
export type OrgRole = 'owner' | 'administrator' | 'reviewer' | 'investigator' | 'responder' | 'analyst' | 'read_only' | 'auditor';
export type MemberStatus = 'Active' | 'Invited' | 'Suspended';

export interface Member { id: string; name: string; email: string; role: OrgRole; status: MemberStatus; }
export interface Decision { id: string; title: string; detail: string; owner: string; week: string; }
export interface EvidenceRecord { id: string; record: string; what: string; hash: string | null; }

export const ROLE_ORDER: OrgRole[] = ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only', 'auditor'];

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'Owner', administrator: 'Administrator', reviewer: 'Reviewer', investigator: 'Investigator',
  responder: 'Responder', analyst: 'Analyst', read_only: 'Read only', auditor: 'Auditor'
};

export const ROLE_SUMMARY: Record<OrgRole, string> = {
  owner: 'Full control of the organisation.',
  administrator: 'Manages people, connections and reviews.',
  reviewer: 'Reviews and approves work.',
  investigator: 'Verifies signals in the field.',
  responder: 'Carries out response actions.',
  analyst: 'Reads data and records evidence.',
  read_only: 'Can look but not change.',
  auditor: 'Reads outcomes, gaps and connections for audit.'
};

export interface Capability { id: string; label: string; roles: OrgRole[]; }

/** Mirrors the role lists in apps/api/src (signal-routes, decision-action-store, evidence-store, outcome-store, action-gap-store, interoperability-store). */
export const CAPABILITIES: Capability[] = [
  { id: 'signals-read', label: 'See signals', roles: ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only'] },
  { id: 'signals-create', label: 'Report signals', roles: ['owner', 'administrator', 'reviewer', 'investigator', 'responder'] },
  { id: 'gaps-read', label: 'See action gaps', roles: ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only', 'auditor'] },
  { id: 'gaps-create', label: 'Raise action gaps', roles: ['owner', 'administrator', 'reviewer', 'investigator', 'analyst'] },
  { id: 'actions-create', label: 'Create response actions', roles: ['owner', 'administrator', 'reviewer', 'responder'] },
  { id: 'evidence-write', label: 'Record evidence', roles: ['owner', 'administrator', 'reviewer', 'investigator', 'analyst'] },
  { id: 'outcomes-create', label: 'Record outcomes', roles: ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst'] },
  { id: 'outcomes-read', label: 'See outcomes', roles: ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only', 'auditor'] },
  { id: 'interop-read', label: 'See connections', roles: ['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only', 'auditor'] }
];

export const DEMO_ORG = {
  name: 'Uganda Ministry of Health, Kasese District Hub',
  level: 'District',
  region: 'Western Uganda',
  timezone: 'Africa/Kampala (EAT, UTC+3)'
};

export const INITIAL_MEMBERS: Member[] = [
  { id: 'usr-1', name: 'Admin Command Center', email: 'command@example.org', role: 'administrator', status: 'Active' },
  { id: 'usr-2', name: 'Officer J. Tumusiime', email: 'j.tumusiime@example.org', role: 'investigator', status: 'Active' },
  { id: 'usr-3', name: 'Dr. K. Mugisha', email: 'k.mugisha@example.org', role: 'reviewer', status: 'Active' },
  { id: 'usr-4', name: 'Field Tech S. Okello', email: 's.okello@example.org', role: 'responder', status: 'Active' },
  { id: 'usr-5', name: 'Epi Analyst (pending)', email: 'analyst@example.org', role: 'analyst', status: 'Invited' }
];

export const INITIAL_DECISIONS: Decision[] = [
  { id: 'DEC-1', title: 'WASH staffing reallocation', detail: 'Deploy 2 additional WASH officers to Kasese Ward 3 following the cholera signal.', owner: 'District lead', week: 'Week 44' },
  { id: 'DEC-2', title: 'Laboratory system escalation', detail: 'Escalate the Central Lab LIMS sample delay to the Ministry systems working group.', owner: 'Laboratory lead', week: 'Week 44' }
];

export const INITIAL_EVIDENCE: EvidenceRecord[] = [
  { id: 'EV-1', record: 'SIG-2026-089', what: 'Lab verification: cholera positivity confirmed', hash: 'e8a91…' },
  { id: 'EV-2', record: 'ACT-108', what: 'AquaTabs delivery receipt: 500 tablets verified', hash: '9b201…' }
];

export const WEEK_LABEL = 'Week 44';
