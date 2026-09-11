import { get, set } from './idb';
import type { EventRecordRow } from './recordCalculations';

const IDB_RECORDS_PREFIX = 'cutter-cubing-records-v2_';
const LS_DIRTY_PREFIX = 'cutter-cubing-records-dirty-v2_';
export const RECORDS_CACHE_EXPIRED_EVENT = 'records-cache-expired';

const memoryCache = new Map<string, EventRecordRow[]>();
const dirtyUsers = new Set<string>();

/**
 * Check if the records cache is flagged as expired / dirty for a user.
 */
export function isRecordsCacheExpired(userId?: string | null): boolean {
    if (!userId) return false;

    if (dirtyUsers.has(userId) || dirtyUsers.has('current')) {
        return true;
    }

    try {
        if (typeof localStorage !== 'undefined') {
            const userDirty = localStorage.getItem(`${LS_DIRTY_PREFIX}${userId}`);
            const globalDirty = localStorage.getItem(`${LS_DIRTY_PREFIX}current`);
            return userDirty === 'true' || globalDirty === 'true';
        }
    } catch {
        // Fallback to in-memory state
    }

    return false;
}

/**
 * Synchronous retrieval of cached records from in-memory cache.
 * Returns null if cache is expired, missing, or empty.
 */
export function getCachedRecordsSync(userId?: string | null): EventRecordRow[] | null {
    if (!userId || isRecordsCacheExpired(userId)) {
        return null;
    }
    const cached = memoryCache.get(userId);
    return (cached && cached.length > 0) ? cached : null;
}

/**
 * Asynchronous retrieval of cached records from in-memory cache or IndexedDB.
 * Returns null if cache is expired, missing, or empty.
 */
export async function getCachedRecords(userId?: string | null): Promise<EventRecordRow[] | null> {
    if (!userId || isRecordsCacheExpired(userId)) {
        return null;
    }

    const inMem = memoryCache.get(userId);
    if (inMem && inMem.length > 0) {
        return inMem;
    }

    try {
        const stored = await get<EventRecordRow[]>(`${IDB_RECORDS_PREFIX}${userId}`);
        if (stored && Array.isArray(stored) && stored.length > 0) {
            memoryCache.set(userId, stored);
            return stored;
        }
    } catch (e) {
        console.warn('Failed to retrieve records from IndexedDB:', e);
    }

    return null;
}

/**
 * Saves fresh records to both in-memory cache and IndexedDB,
 * and clears the dirty / expiration flag.
 */
export async function setCachedRecords(userId: string, rows: EventRecordRow[]): Promise<void> {
    if (!userId) return;

    memoryCache.set(userId, rows);
    dirtyUsers.delete(userId);
    dirtyUsers.delete('current');

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(`${LS_DIRTY_PREFIX}${userId}`);
            localStorage.removeItem(`${LS_DIRTY_PREFIX}current`);
        }
    } catch (e) {
        console.warn('Failed to clear dirty flag in localStorage:', e);
    }

    try {
        await set(`${IDB_RECORDS_PREFIX}${userId}`, rows);
    } catch (e) {
        console.warn('Failed to persist records to IndexedDB:', e);
    }
}

/**
 * Marks the records cache as expired (e.g. after a solve is completed)
 * and dispatches a notification event.
 */
export function expireRecordsCache(userId?: string | null): void {
    const target = userId || 'current';
    dirtyUsers.add(target);

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`${LS_DIRTY_PREFIX}${target}`, 'true');
        }
    } catch (e) {
        console.warn('Failed to persist dirty flag in localStorage:', e);
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RECORDS_CACHE_EXPIRED_EVENT, { detail: { userId } }));
    }
}
