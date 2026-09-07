import { get, set } from './idb';

const IDB_STREAKS_PREFIX = 'cutter-cubing-streaks_';
const LS_STREAKS_DIRTY_PREFIX = 'cutter-cubing-streaks-dirty_';
export const STREAKS_CACHE_EXPIRED_EVENT = 'streaks-cache-expired';

export interface GoalStreakItem {
    goalId: string;
    currentValue: number;
    targetValue: number;
    completed: boolean;
    percentCompleted: number;
    displayCurrent: string;
    displayTarget: string;
    streakStartDate: string | null;
    streakEndDate: string | null;
}

export type StreaksMap = Record<string, GoalStreakItem>;

const memoryStreaksCache = new Map<string, StreaksMap>();
const dirtyUsers = new Set<string>();

export function isStreaksCacheExpired(userId?: string | null): boolean {
    if (!userId) return false;
    if (dirtyUsers.has(userId) || dirtyUsers.has('current')) {
        return true;
    }
    try {
        if (typeof localStorage !== 'undefined') {
            const userDirty = localStorage.getItem(`${LS_STREAKS_DIRTY_PREFIX}${userId}`);
            const globalDirty = localStorage.getItem(`${LS_STREAKS_DIRTY_PREFIX}current`);
            return userDirty === 'true' || globalDirty === 'true';
        }
    } catch {
        // Fallback
    }
    return false;
}

export function getCachedStreaksSync(userId?: string | null): StreaksMap | null {
    if (!userId || isStreaksCacheExpired(userId)) {
        return null;
    }
    return memoryStreaksCache.get(userId) || null;
}

export async function getCachedStreaks(userId?: string | null): Promise<StreaksMap | null> {
    if (!userId || isStreaksCacheExpired(userId)) {
        return null;
    }
    const inMem = memoryStreaksCache.get(userId);
    if (inMem) return inMem;

    try {
        const stored = await get<StreaksMap>(`${IDB_STREAKS_PREFIX}${userId}`);
        if (stored && typeof stored === 'object') {
            memoryStreaksCache.set(userId, stored);
            return stored;
        }
    } catch (e) {
        console.warn('Failed to retrieve streaks from IndexedDB:', e);
    }
    return null;
}

export async function setCachedStreaks(userId: string, data: StreaksMap): Promise<void> {
    if (!userId) return;
    memoryStreaksCache.set(userId, data);
    dirtyUsers.delete(userId);
    dirtyUsers.delete('current');

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(`${LS_STREAKS_DIRTY_PREFIX}${userId}`);
            localStorage.removeItem(`${LS_STREAKS_DIRTY_PREFIX}current`);
        }
    } catch (e) {
        console.warn('Failed to clear streaks dirty flag:', e);
    }

    try {
        await set(`${IDB_STREAKS_PREFIX}${userId}`, data);
    } catch (e) {
        console.warn('Failed to persist streaks to IndexedDB:', e);
    }
}

export function expireStreaksCache(userId?: string | null): void {
    const target = userId || 'current';
    dirtyUsers.add(target);
    if (userId) {
        memoryStreaksCache.delete(userId);
    }

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`${LS_STREAKS_DIRTY_PREFIX}${target}`, 'true');
        }
    } catch (e) {
        console.warn('Failed to persist streaks dirty flag in localStorage:', e);
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(STREAKS_CACHE_EXPIRED_EVENT, { detail: { userId } }));
    }
}
