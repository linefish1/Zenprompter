/**
 * IndexedDB-backed video cache.
 *
 * Recorded blobs are stored locally so the video list survives page reloads.
 * On load, blobs are read from IndexedDB and new object URLs are created.
 */

const DB_NAME = 'TeleprompterVideos';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

export interface CachedVideo {
  id: string;
  blob: Blob;
  timestamp: number;
  duration: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a recorded video blob to IndexedDB and return a CachedVideo record. */
export async function saveVideoCache(
  blob: Blob,
  duration: number
): Promise<CachedVideo> {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const video: CachedVideo = { id, blob, timestamp: Date.now(), duration };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(video);
    req.onsuccess = () => {
      resolve(video);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Load all cached videos from IndexedDB. */
export async function loadAllVideosFromCache(): Promise<CachedVideo[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.index('timestamp').openCursor(null, 'prev'); // newest first
    const results: CachedVideo[] = [];

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value as CachedVideo);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Delete a single video from IndexedDB by id. */
export async function deleteVideoFromCache(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Delete multiple videos from IndexedDB by ids. */
export async function deleteMultipleVideosFromCache(ids: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let completed = 0;
    for (const id of ids) {
      const req = store.delete(id);
      req.onsuccess = () => {
        completed++;
        if (completed === ids.length) resolve();
      };
      req.onerror = () => reject(req.error);
    }
    if (ids.length === 0) resolve();
    tx.oncomplete = () => db.close();
  });
}
