/**
 * Local folder file saver — uses the File System Access API.
 *
 * On first call the user picks a folder (e.g. "我的录像").
 * The directory handle is persisted in a small IndexedDB record so
 * subsequent saves go straight to the same folder without prompting.
 *
 * Falls back to a regular download if the API is unavailable.
 */

const HANDLE_DB = 'TeleprompterSettings';
const HANDLE_STORE = 'dirHandle';
const HANDLE_KEY = 'recordings-folder';

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    const store = tx.objectStore(HANDLE_STORE);
    store.put(handle, HANDLE_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const store = tx.objectStore(HANDLE_STORE);
    const req = store.get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Check if a local directory has been authorised already.
 */
export async function hasDirectoryAccess(): Promise<boolean> {
  try {
    const handle = await loadDirHandle();
    // Verify the handle is still valid
    if (handle) {
      try {
        await handle.requestPermission({ mode: 'readwrite' });
        return true;
      } catch {
        // Permission was revoked — remove stale handle
        await clearDirHandle();
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Ask the user to pick a folder and persist the handle.
 * Returns true if the user selected a folder, false if they cancelled.
 */
export async function requestDirectoryAccess(): Promise<boolean> {
  try {
    const handle = await (window as any).showDirectoryPicker?.();
    if (!handle) return false;
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return false;
    await saveDirHandle(handle);
    return true;
  } catch (err: any) {
    if (err.name === 'AbortError' || err.name === 'SecurityError') return false;
    console.warn('Directory picker not supported:', err);
    return false;
  }
}

/**
 * Save a blob to the previously authorised folder.
 * Throws if no folder has been authorised — caller should call
 * `requestDirectoryAccess()` first.
 */
export async function saveVideoToLocalFolder(
  blob: Blob,
  filename: string
): Promise<void> {
  const handle = await loadDirHandle();
  if (!handle) throw new Error('没有授权文件夹，请先选择保存目录');

  // Re-verify permission (may have been revoked between sessions)
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    await clearDirHandle();
    throw new Error('文件夹权限已失效，请重新授权');
  }

  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * Attempt to delete a video file from the local folder (silent if it doesn't exist).
 */
export async function deleteVideoFromLocalFolder(filename: string): Promise<void> {
  try {
    const handle = await loadDirHandle();
    if (!handle) return;
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return;
    await handle.removeEntry(filename);
  } catch {
    // File may not exist — ignore
  }
}

async function clearDirHandle(): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    const store = tx.objectStore(HANDLE_STORE);
    store.delete(HANDLE_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Fallback: trigger a regular browser download.
 */
export function downloadAsFallback(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
