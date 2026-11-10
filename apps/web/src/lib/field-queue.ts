import type { QueuedMutation, QueuedSignal } from './types';

/** IndexedDB queue for the embedded field prototype. Access tokens are never stored here. */
const fieldDbName = 'publipulse-field-v2';
const fieldDbVersion = 2;
function ensureFieldStores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains('signals')) db.createObjectStore('signals', { keyPath: 'clientSubmissionId' });
  if (!db.objectStoreNames.contains('mutations')) db.createObjectStore('mutations', { keyPath: 'clientMutationId' });
}
export async function readFieldQueue(): Promise<QueuedSignal[]> {
  if (typeof indexedDB === 'undefined') return [];
  return new Promise(resolve => { const request = indexedDB.open(fieldDbName, fieldDbVersion); request.onupgradeneeded = () => ensureFieldStores(request.result); request.onsuccess = () => { const db = request.result; const tx = db.transaction('signals', 'readonly'); const get = tx.objectStore('signals').getAll(); get.onsuccess = () => { resolve(get.result as QueuedSignal[]); db.close(); }; get.onerror = () => { resolve([]); db.close(); }; }; request.onerror = () => resolve([]); });
}
export async function writeFieldQueue(item: QueuedSignal) {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => { const request = indexedDB.open(fieldDbName, fieldDbVersion); request.onupgradeneeded = () => ensureFieldStores(request.result); request.onsuccess = () => { const db = request.result; const tx = db.transaction('signals', 'readwrite'); tx.objectStore('signals').put(item); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }; request.onerror = () => reject(request.error); });
}
export async function removeFieldQueue(id: string) {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => { const request = indexedDB.open(fieldDbName, fieldDbVersion); request.onupgradeneeded = () => ensureFieldStores(request.result); request.onsuccess = () => { const db = request.result; const tx = db.transaction('signals', 'readwrite'); tx.objectStore('signals').delete(id); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }; request.onerror = () => reject(request.error); });
}
export async function readMutationQueue(): Promise<QueuedMutation[]> {
  if (typeof indexedDB === 'undefined') return [];
  return new Promise(resolve => { const request=indexedDB.open(fieldDbName,2); request.onupgradeneeded=()=>ensureFieldStores(request.result); request.onsuccess=()=>{const tx=request.result.transaction('mutations','readonly');const get=tx.objectStore('mutations').getAll();get.onsuccess=()=>resolve(get.result as QueuedMutation[]);get.onerror=()=>resolve([]);};request.onerror=()=>resolve([]);});
}
export async function writeMutationQueue(item:QueuedMutation){if(typeof indexedDB==='undefined')return;await new Promise<void>((resolve,reject)=>{const request=indexedDB.open(fieldDbName,2);request.onupgradeneeded=()=>ensureFieldStores(request.result);request.onsuccess=()=>{const tx=request.result.transaction('mutations','readwrite');tx.objectStore('mutations').put(item);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);});}
export async function removeMutationQueue(id:string){if(typeof indexedDB==='undefined')return;await new Promise<void>((resolve,reject)=>{const request=indexedDB.open(fieldDbName,2);request.onsuccess=()=>{const tx=request.result.transaction('mutations','readwrite');tx.objectStore('mutations').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);});}
