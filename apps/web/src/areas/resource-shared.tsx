/** Small pieces shared by the Costs, Stock and Context areas. These areas show only records from the connected API. */
import { useRef, useState } from 'react';
import { EmptyState } from '../components/ui';
import { useApp } from '../context/AppContext';
import { newClientId } from '../lib/client-id';
import type { ApiConfig } from '../lib/api-client';

/** Returns the connected session, or null when no organisation is connected. */
export function useLiveConfig(): ApiConfig | null {
  return useApp().sessionApiConfig;
}

export function NeedsConnection({ what }: { what: string }) {
  const { setActiveTab, role } = useApp();
  return (
    <EmptyState
      title="Connect your organisation to see this page"
      hint={`${what} is read from your organisation's records, so there is no demonstration data here.${role === 'admin' ? '' : ' Ask an administrator to connect the session.'}`}
      action={role === 'admin' ? <button type="button" className="pp-btn-secondary" onClick={() => setActiveTab('interop')}>Open Interoperability to connect</button> : undefined}
    />
  );
}

/** Runs an async action with busy and error state. Errors are shown as text, never thrown into the UI. */
export function useRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<void>): Promise<boolean> => {
    setBusy(true); setError('');
    try { await fn(); return true; }
    catch (e) {
      const m = e instanceof Error ? e.message : 'Request failed.';
      // A browser reports a dropped connection as "Failed to fetch" or similar, which tells a person nothing.
      setError(/failed to fetch|networkerror|load failed|network request failed/i.test(m) ? 'Could not reach the server. Check your connection and try again.' : m);
      return false;
    }
    finally { setBusy(false); }
  };
  return { busy, error, setError, run };
}

/**
 * One client mutation id per distinct submission. If a request fails and the person presses save again with the same
 * values, the same id is sent, so a lost response cannot record the entry twice. After success a new id is used.
 */
export function useMutationId() {
  const ref = useRef<{ key: string; id: string } | null>(null);
  return {
    idFor(key: string): string {
      if (!ref.current || ref.current.key !== key) ref.current = { key, id: newClientId() };
      return ref.current.id;
    },
    done() { ref.current = null; }
  };
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
