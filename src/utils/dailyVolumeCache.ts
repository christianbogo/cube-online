import { get, set } from './idb';

const IDB_DAILY_VOLUME_PREFIX = 'cutter-cubing-daily-volume_';
const LS_DAILY_VOLUME_DIRTY_PREFIX = 'cutter-cubing-daily-volume-dirty_';
export const DAILY_VOLUME_CACHE_EXPIRED_EVENT = 'daily-volume-cache-expired';

export interface DailyVolumeData {
    dailySolvesCount: Record<string, number>;
    dailySolvesByEvent: Record<string, Record<string, number>>;
}

const memoryDailyVolumeCache = new Map<string, DailyVolumeData>();
const dirtyUsers = new Set<string>();

export function isDailyVolumeCacheExpired(userId?: string | null): boolean {
    if (!userId) return false;
    if (dirtyUsers.has(userId) || dirtyUsers.has('current')) {
        return true;
    }
    try {
        if (typeof localStorage !== 'undefined') {
            const userDirty = localStorage.getItem(`${LS_DAILY_VOLUME_DIRTY_PREFIX}${userId}`);
            const globalDirty = localStorage.getItem(`${LS_DAILY_VOLUME_DIRTY_PREFIX}current`);
            return userDirty === 'true' || globalDirty === 'true';
        }
    } catch {
        // Fallback
    }
    return false;
}

export function getCachedDailyVolumeSync(userId?: string | null): DailyVolumeData | null {
    if (!userId || isDailyVolumeCacheExpired(userId)) {
        return null;
    }
    return memoryDailyVolumeCache.get(userId) || null;
}

export async function getCachedDailyVolume(userId?: string | null): Promise<DailyVolumeData | null> {
    if (!userId || isDailyVolumeCacheExpired(userId)) {
        return null;
    }
    const inMem = memoryDailyVolumeCache.get(userId);
    if (inMem) return inMem;

    try {
        const stored = await get<DailyVolumeData>(`${IDB_DAILY_VOLUME_PREFIX}${userId}`);
        if (stored && stored.dailySolvesCount) {
            memoryDailyVolumeCache.set(userId, stored);
            return stored;
        }
    } catch (e) {
        console.warn('Failed to retrieve daily volume from IndexedDB:', e);
    }
    return null;
}

export async function setCachedDailyVolume(userId: string, data: DailyVolumeData): Promise<void> {
    if (!userId) return;
    memoryDailyVolumeCache.set(userId, data);
    dirtyUsers.delete(userId);
    dirtyUsers.delete('current');

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(`${LS_DAILY_VOLUME_DIRTY_PREFIX}${userId}`);
            localStorage.removeItem(`${LS_DAILY_VOLUME_DIRTY_PREFIX}current`);
        }
    } catch (e) {
        console.warn('Failed to clear daily volume dirty flag:', e);
    }

    try {
        await set(`${IDB_DAILY_VOLUME_PREFIX}${userId}`, data);
    } catch (e) {
        console.warn('Failed to persist daily volume to IndexedDB:', e);
    }
}

export function expireDailyVolumeCache(userId?: string | null): void {
    const target = userId || 'current';
    dirtyUsers.add(target);
    if (userId) {
        memoryDailyVolumeCache.delete(userId);
    }

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`${LS_DAILY_VOLUME_DIRTY_PREFIX}${target}`, 'true');
        }
    } catch (e) {
        console.warn('Failed to persist daily volume dirty flag in localStorage:', e);
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(DAILY_VOLUME_CACHE_EXPIRED_EVENT, { detail: { userId } }));
    }
}
