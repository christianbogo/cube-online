import { get, set } from './idb';

const IDB_SIDEBAR_PREFIX = 'cutter-cubing-logs-sidebar_';
const LS_DIRTY_PREFIX = 'cutter-cubing-logs-dirty_';
export const LOGS_CACHE_EXPIRED_EVENT = 'logs-cache-expired';

export interface SidebarItemStats {
    count: number;
    bestSingle: number | 'DNF' | null;
    bestAo5: number | 'DNF' | null;
    bestAo12: number | 'DNF' | null;
    bestAo100: number | 'DNF' | null;
    totalTime: number;
}

export interface SidebarGroupItem {
    key: string;
    label: string;
    date: string;
    stats: SidebarItemStats;
}

export interface SidebarOverallStats {
    count: number;
    mean: number | 'DNF' | null;
    stdDev: number | null;
    bestSingle: number | 'DNF' | null;
    bestAo5: number | 'DNF' | null;
    bestAo12: number | 'DNF' | null;
    bestAo100: number | 'DNF' | null;
    bestAo1000: number | 'DNF' | null;
    bestAo10000: number | 'DNF' | null;
    totalTime: number;
}

export interface SidebarCachedData {
    groupsByGrouping: Record<string, SidebarGroupItem[]>;
    overallStats: SidebarOverallStats | null;
}

const memorySidebarCache = new Map<string, SidebarCachedData>();
const dirtyUsers = new Set<string>();

/**
 * Checks if the logs cache is flagged as expired / dirty for a user.
 */
export function isLogsCacheExpired(userId?: string | null): boolean {
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
 * Synchronous retrieval of cached left bar summary data from in-memory cache.
 * Returns null if cache is expired, missing, or empty.
 */
export function getCachedSidebarDataSync(userId?: string | null, scrambleType?: string, allowStale = false): SidebarCachedData | null {
    if (!userId || !scrambleType) {
        return null;
    }
    if (!allowStale && isLogsCacheExpired(userId)) {
        return null;
    }
    const key = `${userId}_${scrambleType}`;
    const cached = memorySidebarCache.get(key);
    return cached || null;
}

/**
 * Asynchronous retrieval of cached left bar summary data from in-memory cache or IndexedDB.
 * Returns null if cache is expired, missing, or empty.
 */
export async function getCachedSidebarData(userId?: string | null, scrambleType?: string, allowStale = false): Promise<SidebarCachedData | null> {
    if (!userId || !scrambleType) {
        return null;
    }
    if (!allowStale && isLogsCacheExpired(userId)) {
        return null;
    }

    const key = `${userId}_${scrambleType}`;
    const inMem = memorySidebarCache.get(key);
    if (inMem) {
        return inMem;
    }

    try {
        const stored = await get<SidebarCachedData>(`${IDB_SIDEBAR_PREFIX}${key}`);
        if (stored && stored.groupsByGrouping) {
            memorySidebarCache.set(key, stored);
            return stored;
        }
    } catch (e) {
        console.warn('Failed to retrieve sidebar data from IndexedDB:', e);
    }

    return null;
}

/**
 * Saves left bar summary text content to both in-memory cache and IndexedDB,
 * and clears the dirty / expiration flag.
 *
 * NOTE: Only the compact summary text and statistics that take up the left bar
 * are stored to optimize browser storage efficiency. No raw solve objects are stored.
 */
export async function setCachedSidebarData(userId: string, scrambleType: string, data: SidebarCachedData): Promise<void> {
    if (!userId || !scrambleType) return;

    const key = `${userId}_${scrambleType}`;
    memorySidebarCache.set(key, data);
    dirtyUsers.delete(userId);
    dirtyUsers.delete('current');

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(`${LS_DIRTY_PREFIX}${userId}`);
            localStorage.removeItem(`${LS_DIRTY_PREFIX}current`);
        }
    } catch (e) {
        console.warn('Failed to clear logs dirty flag in localStorage:', e);
    }

    try {
        await set(`${IDB_SIDEBAR_PREFIX}${key}`, data);
    } catch (e) {
        console.warn('Failed to persist sidebar data to IndexedDB:', e);
    }
}

/**
 * Marks the logs cache as expired (e.g. after a solve has been added or deleted)
 * and dispatches a notification event.
 */
export function expireLogsCache(userId?: string | null): void {
    const target = userId || 'current';
    dirtyUsers.add(target);

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`${LS_DIRTY_PREFIX}${target}`, 'true');
        }
    } catch (e) {
        console.warn('Failed to persist logs dirty flag in localStorage:', e);
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(LOGS_CACHE_EXPIRED_EVENT, { detail: { userId } }));
    }
}
