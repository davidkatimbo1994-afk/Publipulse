import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  INITIAL_DECISIONS, INITIAL_EVIDENCE, INITIAL_MEMBERS, WEEK_LABEL,
  type Decision, type EvidenceRecord, type Member, type MemberStatus, type OrgRole
} from '../data/org';

/** Session-only state for the Settings, Outcomes and Weekly Review areas.
 *  Nothing here is sent to the server; it resets when the page is refreshed.
 *  The server stays the source of truth for users, evidence and decisions.
 */
interface WorkspaceState {
  members: Member[];
  inviteMember: (name: string, email: string, role: OrgRole) => void;
  setMemberRole: (id: string, role: OrgRole) => void;
  setMemberStatus: (id: string, status: MemberStatus) => void;
  evidence: EvidenceRecord[];
  addEvidence: (record: string, what: string) => void;
  decisions: Decision[];
  addDecision: (title: string, detail: string, owner: string) => void;
  signedOffAt: string | null;
  signOffWeek: () => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>(INITIAL_EVIDENCE);
  const [decisions, setDecisions] = useState<Decision[]>(INITIAL_DECISIONS);
  const [signedOffAt, setSignedOffAt] = useState<string | null>(null);
  const memberSeq = useRef(INITIAL_MEMBERS.length + 1);
  const evidenceSeq = useRef(INITIAL_EVIDENCE.length + 1);
  const decisionSeq = useRef(INITIAL_DECISIONS.length + 1);

  const inviteMember = useCallback((name: string, email: string, role: OrgRole) => {
    const id = `usr-${memberSeq.current++}`;
    setMembers((prev) => [...prev, { id, name, email, role, status: 'Invited' }]);
  }, []);
  const setMemberRole = useCallback((id: string, role: OrgRole) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
  }, []);
  const setMemberStatus = useCallback((id: string, status: MemberStatus) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }, []);
  const addEvidence = useCallback((record: string, what: string) => {
    const id = `EV-${evidenceSeq.current++}`;
    // No hash is invented: a real content hash is produced by the server when evidence is stored there.
    setEvidence((prev) => [{ id, record, what, hash: null }, ...prev]);
  }, []);
  const addDecision = useCallback((title: string, detail: string, owner: string) => {
    const id = `DEC-${decisionSeq.current++}`;
    setDecisions((prev) => [...prev, { id, title, detail, owner, week: WEEK_LABEL }]);
  }, []);
  const signOffWeek = useCallback(() => {
    setSignedOffAt(`${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`);
  }, []);

  const value = useMemo<WorkspaceState>(() => ({
    members, inviteMember, setMemberRole, setMemberStatus, evidence, addEvidence, decisions, addDecision, signedOffAt, signOffWeek
  }), [members, inviteMember, setMemberRole, setMemberStatus, evidence, addEvidence, decisions, addDecision, signedOffAt, signOffWeek]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
