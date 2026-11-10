/**
 * Field offline queue.
 *
 * Rules (aligned with docs/FIELD_OFFLINE_PILOT.md):
 * - Access tokens are NEVER stored in IndexedDB / localStorage / sessionStorage.
 * - Queued payloads exclude direct patient identifiers.
 * - Replay uses client mutation / submission IDs for idempotency.
 * - Failed or conflicted items stay visible; nothing is silently dropped.
 */

export type QueuedSignal = {
  clientSubmissionId: string;
  category: string;
  summary: string;
  observedAt: string;
  location: { administrativeAreaCode: string; precision: string };
  sourceType: string;
  queuedAt: string;
};

export type QueuedMutation = {
  clientMutationId: string;
  kind: 'action_update' | 'outcome_assessment';
  actionId?: string;
  signalId?: string;
  payload: Record<string, unknown>;
  queuedAt: string;
};

const DB_NAME = 'publipulse-field-v1';
const DB_VERSION = 1;
const SIGNALS_STORE = 'signals';
const MUTATIONS_STORE = 'mutations';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SIGNALS_STORE)) {
        db.createObjectStore(SIGNALS_STORE, { keyPath: 'clientSubmissionId' });
      }
      if (!db.objectStoreNames.contains(MUTATIONS_STORE)) {
        db.createObjectStore(MUTATIONS_STORE, { keyPath: 'clientMutationId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    tx.oncomplete = () => {
      db.close();
      resolve(req && 'result' in req ? req.result : undefined);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB transaction failed'));
    };
    // A commit-time failure (for example storage quota exceeded) fires only `abort`, never `error` or `complete`.
    // Without this the promise never settles and the UI waits forever on a save that did not happen.
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    };
    if (req && 'onerror' in req) {
      req.onerror = () => reject(req.error);
    }
  });
}

export async function readSignalQueue(): Promise<QueuedSignal[]> {
  const result = await withStore<QueuedSignal[]>(SIGNALS_STORE, 'readonly', (store) => store.getAll());
  return (result as QueuedSignal[]) ?? [];
}

export async function enqueueSignal(item: QueuedSignal): Promise<void> {
  await withStore(SIGNALS_STORE, 'readwrite', (store) => {
    store.put(item);
  });
}

export async function removeSignal(clientSubmissionId: string): Promise<void> {
  await withStore(SIGNALS_STORE, 'readwrite', (store) => {
    store.delete(clientSubmissionId);
  });
}

export async function readMutationQueue(): Promise<QueuedMutation[]> {
  const result = await withStore<QueuedMutation[]>(MUTATIONS_STORE, 'readonly', (store) => store.getAll());
  return (result as QueuedMutation[]) ?? [];
}

export async function enqueueMutation(item: QueuedMutation): Promise<void> {
  await withStore(MUTATIONS_STORE, 'readwrite', (store) => {
    store.put(item);
  });
}

export async function removeMutation(clientMutationId: string): Promise<void> {
  await withStore(MUTATIONS_STORE, 'readwrite', (store) => {
    store.delete(clientMutationId);
  });
}

/** Classify HTTP status for offline replay (mirrors packages/shared offline-workflow). */
export function classifyReplay(
  status: number
): 'accepted' | 'replayed' | 'conflict' | 'retryable' | 'permanent_failure' {
  if (status === 200 || status === 201) return 'accepted';
  if (status === 409) return 'conflict';
  if (status === 408 || status === 425 || status === 429 || status >= 500) return 'retryable';
  return 'permanent_failure';
}

/** RFC 4122 v4 id. The API requires a real UUID, and crypto.randomUUID is missing on insecure (plain http) origins. */
export function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
