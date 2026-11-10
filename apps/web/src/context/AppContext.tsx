import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ActionGap, HealthSignal, InteropSystem, ResponseAction, Role, WorkingArea } from '../data/types';
import { INITIAL_ACTIONS, INITIAL_GAPS, INITIAL_INTEROP_SYSTEMS, INITIAL_SIGNALS } from '../data/fixtures';
import { toSharedStatus, toSignalIntakeDraft } from '../data/domain-map';
import { type ApiConfig, type SignalIntakeBody, isConfigReady, submitSignal } from '../lib/api-client';
import { flushQueue } from '../data/derive';
import { newClientId } from '../lib/client-id';

interface AppState {
  role: Role; setRole: (role: Role) => void;
  isOnline: boolean; toggleOnline: () => void;
  activeTab: WorkingArea; setActiveTab: (tab: WorkingArea) => void;
  isMobileMenuOpen: boolean; setMobileMenuOpen: (open: boolean) => void;
  signals: HealthSignal[]; offlineQueue: HealthSignal[];
  gaps: ActionGap[]; actions: ResponseAction[]; systems: InteropSystem[];
  searchQuery: string; setSearchQuery: (q: string) => void;
  filterSeverity: string; setFilterSeverity: (s: string) => void;
  reportSignal: (data: Omit<HealthSignal, 'id' | 'reportedAt' | 'reporter' | 'syncStatus' | 'status'>) => void;
  createAction: (data: Omit<ResponseAction, 'id' | 'status' | 'signalId'>, signalId?: string) => void;
  toggleActionStatus: (id: string) => void;
  /** Sends queued signals now (live session) or marks them synced (demonstration mode). No-op when the queue is empty. */
  syncQueue: () => Promise<void>;
  /** Removes one queued signal from this session after the user confirms it; used for reports the server keeps refusing. */
  discardQueued: (id: string) => void;
  /** Demonstration-only: marks a gap as escalated in this session. */
  escalateGap: (id: string) => void;
  toggleSystemStatus: (id: string) => void;
  isNewSignalModalOpen: boolean; setNewSignalModalOpen: (open: boolean) => void;
  isNewActionModalOpen: boolean; setNewActionModalOpen: (open: boolean) => void;
  selectedSignalForAction: HealthSignal | null; setSelectedSignalForAction: (s: HealthSignal | null) => void;
  sessionApiConfig: ApiConfig | null; setSessionApiConfig: (c: ApiConfig | null) => void;
  lastSubmitNotice: string; setLastSubmitNotice: (n: string) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('officer');
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkingArea>('dashboard');
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signals, setSignals] = useState<HealthSignal[]>(INITIAL_SIGNALS);
  const [offlineQueue, setOfflineQueue] = useState<HealthSignal[]>([]);
  const [gaps, setGaps] = useState<ActionGap[]>(INITIAL_GAPS);
  const [actions, setActions] = useState<ResponseAction[]>(INITIAL_ACTIONS);
  const [systems, setSystems] = useState<InteropSystem[]>(INITIAL_INTEROP_SYSTEMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [isNewSignalModalOpen, setNewSignalModalOpen] = useState(false);
  const [isNewActionModalOpen, setNewActionModalOpen] = useState(false);
  const [selectedSignalForAction, setSelectedSignalForAction] = useState<HealthSignal | null>(null);
  const [sessionApiConfig, setSessionApiConfig] = useState<ApiConfig | null>(null);
  const [lastSubmitNotice, setLastSubmitNotice] = useState('');
  // Session-unique ids: a counter cannot collide with itself or with fixtures the way a random 3-digit number can.
  const signalSeq = useRef(100);
  const actionSeq = useRef(110);
  const syncing = useRef(false);

  /** The shared SignalIntake body for a signal, reusing its original client id and observed time on every retry. */
  const intakeBodyFor = (item: HealthSignal): SignalIntakeBody => {
    const draft = toSignalIntakeDraft({
      disease: item.disease, location: item.location, notes: item.notes, cases: item.cases, deaths: item.deaths
    });
    return {
      clientSubmissionId: item.clientSubmissionId ?? newClientId(),
      category: draft.category,
      summary: draft.summary,
      observedAt: item.observedAt ?? draft.observedAtHint,
      location: draft.location,
      sourceType: draft.sourceType
    };
  };

  const syncQueue = useCallback(async () => {
    if (syncing.current || offlineQueue.length === 0) return;
    syncing.current = true;
    try {
      const pending = offlineQueue;
      const live = sessionApiConfig && isConfigReady(sessionApiConfig) ? sessionApiConfig : null;
      const { sent, failed } = live
        ? await flushQueue(pending, (item) => submitSignal(live, intakeBodyFor(item)))
        : { sent: [...pending], failed: [] as HealthSignal[] };
      if (sent.length > 0) {
        const sentIds = new Set(sent.map((item) => item.id));
        setSignals((prev) => [...sent.map((item) => ({ ...item, syncStatus: 'synced' as const })), ...prev]);
        setOfflineQueue((prev) => prev.filter((item) => !sentIds.has(item.id)));
      }
      setLastSubmitNotice(
        !live
          ? `Demo mode: ${sent.length} queued signal${sent.length === 1 ? '' : 's'} marked synced in this browser session only.`
          : failed.length === 0
            ? `${sent.length} queued signal${sent.length === 1 ? '' : 's'} sent to the authorized organization.`
            : `${sent.length} sent, ${failed.length} still queued on this device. Use "Retry sync now" to try again.`
      );
    } finally {
      syncing.current = false;
    }
    // intakeBodyFor only reads its argument and stable imports, so it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineQueue, sessionApiConfig]);

  const discardQueued = useCallback((id: string) => {
    setOfflineQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleOnline = useCallback(() => {
    // State updaters must be pure (React runs them twice in development), so side effects live out here.
    if (isOnline) {
      setIsOnline(false);
      return;
    }
    setIsOnline(true);
    void syncQueue();
  }, [isOnline, syncQueue]);

  const reportSignal = useCallback(
    (data: Omit<HealthSignal, 'id' | 'reportedAt' | 'reporter' | 'syncStatus' | 'status'>) => {
      const draft = toSignalIntakeDraft({
        disease: data.disease,
        location: data.location,
        notes: data.notes,
        cases: data.cases,
        deaths: data.deaths
      });
      const newSignal: HealthSignal = {
        id: `SIG-${new Date().getFullYear()}-${signalSeq.current++}`,
        clientSubmissionId: newClientId(),
        observedAt: new Date().toISOString(),
        ...data,
        status: 'Under Investigation',
        reportedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        reporter: role === 'officer' ? 'Officer J. Tumusiime (Field)' : 'Admin Command Center',
        syncStatus: isOnline ? 'synced' : 'pending_offline',
        sharedStatus: toSharedStatus('Under Investigation'),
        category: draft.category
      };

      // Optimistic local list update; optional live API when session credentials are present
      const pushLocal = (syncStatus: HealthSignal['syncStatus']) => {
        const item = { ...newSignal, syncStatus };
        if (syncStatus === 'synced') setSignals((prev) => [item, ...prev]);
        else setOfflineQueue((prev) => [item, ...prev]);
      };

      if (!isOnline) {
        pushLocal('pending_offline');
        setLastSubmitNotice('Offline: signal queued locally. It will not appear as server-saved until sync succeeds.');
        setNewSignalModalOpen(false);
        return;
      }

      if (sessionApiConfig && isConfigReady(sessionApiConfig)) {
        const body = intakeBodyFor(newSignal);
        void submitSignal(sessionApiConfig, body)
          .then(() => {
            pushLocal('synced');
            setLastSubmitNotice('Signal submitted to the authorized organization.');
          })
          .catch((error) => {
            pushLocal('pending_offline');
            setLastSubmitNotice(
              `${error instanceof Error ? error.message : 'Submit failed'}. Queued locally for later retry.`
            );
          });
      } else {
        pushLocal('synced');
        setLastSubmitNotice('Demo mode: signal saved in this browser session only (no API credentials).');
      }
      setNewSignalModalOpen(false);
    },
    [isOnline, role, sessionApiConfig]
  );

  const createAction = useCallback(
    (data: Omit<ResponseAction, 'id' | 'status' | 'signalId'>, signalId?: string) => {
      const newAction: ResponseAction = {
        id: `ACT-${actionSeq.current++}`,
        ...data,
        signalId: signalId ?? selectedSignalForAction?.id ?? 'GENERAL',
        status: 'In Progress'
      };
      setActions((prev) => [newAction, ...prev]);
      setNewActionModalOpen(false);
      setSelectedSignalForAction(null);
    },
    [selectedSignalForAction]
  );

  const toggleActionStatus = useCallback((id: string) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === 'Completed' ? 'In Progress' : 'Completed' } : a
      )
    );
  }, []);

  const escalateGap = useCallback((id: string) => {
    setGaps((prev) => prev.map((g) => (g.id === id ? { ...g, escalated: true } : g)));
  }, []);

  const toggleSystemStatus = useCallback((id: string) => {
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id !== id) return sys;
        return { ...sys, status: (sys.status === 'Connected' ? 'Offline' : 'Connected') as InteropSystem['status'] };
      })
    );
  }, []);

  const value = useMemo<AppState>(
    () => ({
      role, setRole, isOnline, toggleOnline, activeTab, setActiveTab,
      isMobileMenuOpen, setMobileMenuOpen, signals, offlineQueue, gaps, actions, systems,
      searchQuery, setSearchQuery, filterSeverity, setFilterSeverity,
      reportSignal, createAction, toggleActionStatus, syncQueue, discardQueued, escalateGap, toggleSystemStatus,
      isNewSignalModalOpen, setNewSignalModalOpen, isNewActionModalOpen, setNewActionModalOpen,
      selectedSignalForAction, setSelectedSignalForAction,
      sessionApiConfig, setSessionApiConfig, lastSubmitNotice, setLastSubmitNotice
    }),
    [role, isOnline, toggleOnline, activeTab, isMobileMenuOpen, signals, offlineQueue, gaps, actions, systems,
      searchQuery, filterSeverity, reportSignal, createAction, toggleActionStatus, syncQueue, discardQueued, escalateGap, toggleSystemStatus,
      isNewSignalModalOpen, isNewActionModalOpen, selectedSignalForAction, sessionApiConfig, lastSubmitNotice]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
