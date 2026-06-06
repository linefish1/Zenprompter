import { ScriptLibraryItem, SCRIPT_LIBRARY_KEY } from '../types';

/**
 * Custom event name for script library changes.
 * Dispatched on window whenever a script is saved, deleted, or the library is modified.
 * Components listen for this event to auto-refresh their script lists.
 */
export const SCRIPT_LIBRARY_CHANGE_EVENT = 'zen:script-library-changed';

/**
 * Broadcast that the script library has changed.
 * Call this after any save/delete/import operation.
 */
export function broadcastScriptLibraryChange(): void {
  window.dispatchEvent(new CustomEvent(SCRIPT_LIBRARY_CHANGE_EVENT));
}

/**
 * Ensure all scripts have the usageCount field (migration for old data).
 */
function migrateUsageCount(library: ScriptLibraryItem[]): ScriptLibraryItem[] {
  return library.map(item => ({
    ...item,
    usageCount: typeof item.usageCount === 'number' ? item.usageCount : 0,
  }));
}

/**
 * Load all scripts from localStorage.
 * Returns an empty array if nothing is stored or parsing fails.
 * Automatically migrates old data to include usageCount.
 */
export function loadScriptLibrary(): ScriptLibraryItem[] {
  try {
    const raw = localStorage.getItem(SCRIPT_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const migrated = migrateUsageCount(parsed);
    // Write back if any migration was applied
    if (JSON.stringify(migrated) !== raw) {
      localStorage.setItem(SCRIPT_LIBRARY_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return [];
  }
}

/**
 * Save the full script library to localStorage and broadcast the change.
 */
export function saveScriptLibrary(library: ScriptLibraryItem[]): void {
  localStorage.setItem(SCRIPT_LIBRARY_KEY, JSON.stringify(library));
  broadcastScriptLibraryChange();
}

/**
 * Save the full script library to localStorage WITHOUT broadcasting.
 * Used by internal auto-save effects to persist data without triggering
 * cross-component event cycles that cause infinite re-renders.
 */
export function saveScriptLibrarySilent(library: ScriptLibraryItem[]): void {
  localStorage.setItem(SCRIPT_LIBRARY_KEY, JSON.stringify(library));
}

/**
 * Save a single new script to the library.
 */
export function addScriptToLibrary(script: ScriptLibraryItem): void {
  const library = loadScriptLibrary();
  library.unshift(script);
  saveScriptLibrary(library);
}

/**
 * Increment the usage count for a script by ID.
 * Called when a user loads/uses a script from the library.
 */
export function incrementScriptUsage(id: string): void {
  const library = loadScriptLibrary();
  const item = library.find(s => s.id === id);
  if (item) {
    item.usageCount = (item.usageCount || 0) + 1;
    item.updatedAt = Date.now();
    saveScriptLibrary(library);
  }
}

/**
 * Get scripts sorted by usageCount descending (most popular first).
 * @param limit Optional max number to return (default: all)
 */
export function getHotScripts(limit?: number): ScriptLibraryItem[] {
  const library = loadScriptLibrary();
  const sorted = [...library].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Delete a script from the library by ID.
 */
export function deleteScriptFromLibrary(id: string): void {
  const library = loadScriptLibrary();
  const updated = library.filter(item => item.id !== id);
  saveScriptLibrary(updated);
}

/**
 * Export the entire script library as a downloadable JSON file.
 * This serves as the "数据固化" — data solidification — feature.
 */
export function exportScriptLibraryToFile(): void {
  const library = loadScriptLibrary();
  if (library.length === 0) return;

  const blob = new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  a.download = `提词库备份_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import scripts from a JSON file. Merges into existing library (dedup by ID).
 */
export function importScriptLibraryFromFile(file: File): Promise<{ added: number; skipped: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported: ScriptLibraryItem[] = JSON.parse(reader.result as string);
        if (!Array.isArray(imported)) throw new Error('Invalid format');

        const existing = loadScriptLibrary();
        const existingIds = new Set(existing.map(s => s.id));
        let added = 0;
        let skipped = 0;

        for (const item of imported) {
          if (!item.id || !item.content) {
            skipped++;
            continue;
          }
          if (existingIds.has(item.id)) {
            skipped++;
            continue;
          }
          existing.push(item);
          existingIds.add(item.id);
          added++;
        }

        saveScriptLibrary(existing);
        resolve({ added, skipped });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
