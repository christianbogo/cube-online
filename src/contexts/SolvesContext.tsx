import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { calculateAverage, calculateBestAverage } from '../utils/calculations';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';
import { useNotifications } from './NotificationsContext';
import { doc, setDoc, deleteDoc, collection, query, where, orderBy, limit, onSnapshot, serverTimestamp, addDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { get, set, del } from '../utils/idb';
import { expireRecordsCache } from '../utils/recordsCache';
import { expireLogsCache } from '../utils/logsCache';
import { expireDailyVolumeCache } from '../utils/dailyVolumeCache';
import { expireStreaksCache } from '../utils/streaksCache';
import type { Solve, Stats, SyncStatus } from '../types';

export type { Solve, Stats, SyncStatus };

interface SolvesContextType {
    solves: Solve[];
    stats: Stats;
    userStats: any | null;
    addSolve: (solve: Solve) => Promise<void>;
    updateSolve: (id: string, updates: Partial<Solve>) => void;
    deleteSolve: (id: string) => void;
    clearSolves: (keepBest: boolean) => void;
    deleteAllSolves: () => Promise<void>;
    deleteImportedSolves: (source?: string) => Promise<{ deletedCount: number }>;
    trimSolves: (limit: number) => void;
    currentScramble: string | null;
    setCurrentScramble: (scramble: string) => void;
    syncStatus: SyncStatus;
    importSolves: (
        importedSolves: Solve[],
        options?: {
            skipDuplicates?: boolean;
            replaceExistingImports?: boolean;
            onProgress?: (processed: number, total: number) => void;
        }
    ) => Promise<{ importedCount: number; skippedCount: number }>;
}

// Persistent Pending Sync Queue Helpers (for offline durability)
interface PendingSyncItem {
    id: string;
    solve: Solve;
    action: 'add' | 'update' | 'delete';
    timestamp: number;
}

const getPendingQueue = (): PendingSyncItem[] => {
    try {
        const raw = localStorage.getItem('cutter-cubing-pending-sync');
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const savePendingQueue = (queue: PendingSyncItem[]) => {
    try {
        localStorage.setItem('cutter-cubing-pending-sync', JSON.stringify(queue));
    } catch (e) {
        console.error('Failed to persist pending sync queue', e);
    }
};

const addToPendingQueue = (solve: Solve, action: 'add' | 'update' | 'delete') => {
    const queue = getPendingQueue();
    const filtered = queue.filter(item => item.solve.id !== solve.id);
    filtered.push({
        id: solve.id,
        solve,
        action,
        timestamp: Date.now()
    });
    savePendingQueue(filtered);
};

const removeFromPendingQueue = (solveId: string) => {
    const queue = getPendingQueue();
    const filtered = queue.filter(item => item.solve.id !== solveId);
    savePendingQueue(filtered);
};

const SolvesContext = createContext<SolvesContextType | undefined>(undefined);

export function SolvesProvider({ children }: { children: ReactNode }) {
    // const { settings } = useSettings(); // Unused
    const { user } = useAuth();
    const { currentSessionId, checkSessionStatus, updateSessionActivity, setCurrentSessionId, startNewSession } = useSession();
    const { upsertNotification } = useNotifications();

    const [solves, setSolves] = useState<Solve[]>([]);
    
    // PB Streak tracking
    const [pbStreak, setPbStreak] = useState<{ single: number | null, count: number } | null>(null);

    useEffect(() => {
        get('cutter-cubing-solves').then(async (stored: unknown) => {
            if (stored) {
                let idbSolves = typeof stored === 'string' ? JSON.parse(stored) : (stored as Solve[]);
                if (idbSolves.length > 100) {
                    idbSolves = idbSolves.slice(0, 100);
                    try {
                        await set('cutter-cubing-solves', idbSolves);
                    } catch (e) {
                        console.error('Failed to truncate IDB cache:', e);
                    }
                }
                setSolves(idbSolves);
                idbSolveCountRef.current = idbSolves.length;
            }
        }).catch(console.error);
    }, []);

    const prevUserRef = useRef<{ uid: string } | null | undefined>(undefined);

    // Wipe local solves on auth state change (Sign In / Sign Out), but preserve/associate on Account Creation (Sign Up)
    useEffect(() => {
        const isFirstRun = prevUserRef.current === undefined;
        const prevUser = prevUserRef.current;
        const currentUser = user;

        if (!isFirstRun) {
            const prevUid = prevUser?.uid;
            const currentUid = currentUser?.uid;

            if (prevUid !== currentUid) {
                // Check if this was a new account sign up
                const justSignedUpUid = sessionStorage.getItem('just_signed_up_uid');
                if (currentUid && justSignedUpUid === currentUid) {
                    sessionStorage.removeItem('just_signed_up_uid');
                    setSolves(prev => prev.map(s => ({ ...s, userId: currentUid })));
                } else {
                    // Regular Sign In or Sign Out: wipe local solves
                    setSolves([]);
                    del('cutter-cubing-solves').catch(console.error);
                }
            }
        }

        prevUserRef.current = user;
    }, [user]);

    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

    const idbWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idbSolveCountRef = useRef<number>(0);
    const pendingDeleteIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (idbWriteTimerRef.current !== null) {
            clearTimeout(idbWriteTimerRef.current);
        }
        idbWriteTimerRef.current = setTimeout(async () => {
            try {
                if (solves.length >= idbSolveCountRef.current && pendingDeleteIdsRef.current.size === 0) {
                    // State has same or more solves and no pending deletes — safe direct replace
                    await set('cutter-cubing-solves', solves);
                    idbSolveCountRef.current = solves.length;
                } else {
                    // State has fewer solves than IDB (limited-window) OR there are pending deletes
                    // Must merge: read IDB, apply state updates, apply explicit deletes
                    const existing: Solve[] | undefined = await get('cutter-cubing-solves');
                    if (!existing || existing.length === 0) {
                        await set('cutter-cubing-solves', solves);
                        idbSolveCountRef.current = solves.length;
                    } else {
                        const idbMap = new Map(existing.map((s: Solve) => [s.id, s]));
                        solves.forEach((s: Solve) => idbMap.set(s.id, s));
                        pendingDeleteIdsRef.current.forEach((id: string) => idbMap.delete(id));
                        pendingDeleteIdsRef.current.clear();
                        const merged = Array.from(idbMap.values());
                        await set('cutter-cubing-solves', merged);
                        idbSolveCountRef.current = merged.length;
                    }
                }
            } catch (e) {
                console.error('IDB write error:', e);
            }
        }, 1500);

        return () => {
            if (idbWriteTimerRef.current !== null) {
                clearTimeout(idbWriteTimerRef.current);
            }
        };
    }, [solves]);

    // Process queued offline solves when online
    const isSyncingQueueRef = useRef(false);
    const bestAverageCacheRef = useRef<{ key: string; ao5: number | 'DNF' | null; ao12: number | 'DNF' | null; ao100: number | 'DNF' | null } | null>(null);
    const processPendingQueue = useCallback(async () => {
        if (!user || isSyncingQueueRef.current) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;

        const queue = getPendingQueue();
        if (queue.length === 0) return;

        isSyncingQueueRef.current = true;
        setSyncStatus('syncing');

        const remainingQueue: PendingSyncItem[] = [];

        for (const item of queue) {
            try {
                if (item.action === 'delete') {
                    await deleteDoc(doc(db, 'solves', item.solve.id));
                } else {
                    const dataToSave: any = {
                        ...item.solve,
                        userId: user.uid,
                        updatedAt: serverTimestamp()
                    };
                    Object.keys(dataToSave).forEach(key => {
                        if (dataToSave[key] === undefined) delete dataToSave[key];
                    });
                    await setDoc(doc(db, 'solves', item.solve.id), dataToSave);
                }
            } catch (err: any) {
                console.warn('Could not sync pending solve:', item.solve.id, err);
                if (err?.code === 'permission-denied') {
                    console.warn(`Solve ${item.solve.id} blocked by security rules (likely owned by another account). Evicting from queue.`);
                    // Do not push back to remainingQueue
                } else {
                    remainingQueue.push(item);
                }
            }
        }

        savePendingQueue(remainingQueue);
        isSyncingQueueRef.current = false;

        if (remainingQueue.length === 0) {
            setSyncStatus('synced');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } else {
            setSyncStatus('error');
        }
    }, [user]);

    // Sync pending solves on network restore and window focus
    useEffect(() => {
        const handleOnline = () => {
            processPendingQueue();
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                processPendingQueue();
            }
        };

        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibility);

        // Run on mount or when user changes (deferred to avoid cascading render)
        if (user) {
            const timer = setTimeout(() => {
                processPendingQueue();
            }, 50);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('online', handleOnline);
                document.removeEventListener('visibilitychange', handleVisibility);
            };
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [user, processPendingQueue]);

    // Cloud Sync Logic
    useEffect(() => {
        if (!user) {
            setSyncStatus('idle');
            return;
        }

        // Listen for remote changes
        const q = query(collection(db, 'solves'), where('userId', '==', user.uid), orderBy('date', 'desc'), limit(100));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const addedOrModified: Solve[] = [];

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data();
                    addedOrModified.push({
                        id: change.doc.id,
                        time: data.time,
                        scramble: data.scramble,
                        date: data.date,
                        penalty: data.penalty || 'none',
                        inspectionTime: data.inspectionTime,
                        inspectionPenalty: data.inspectionPenalty || 'none',
                        sessionId: data.sessionId,
                        userId: data.userId,
                        scrambleType: data.scrambleType || '333',
                        anomalyApproved: data.anomalyApproved,
                        source: data.source
                    });
                }
                // 'removed' intentionally not handled here:
                // - Real deletes are handled directly by deleteSolve() which updates state immediately
                // - limit(500) window evictions should not affect the full IDB-backed state
            });

            if (addedOrModified.length > 0) {
                setSolves(prev => {
                    const solveMap = new Map(prev.map(s => [s.id, s]));
                    addedOrModified.forEach(s => solveMap.set(s.id, s));
                    const next = Array.from(solveMap.values());

                    // Pre-compute timestamps for efficient sorting
                    return next
                        .map(s => ({ solve: s, ts: new Date(s.date).getTime() }))
                        .sort((a, b) => b.ts - a.ts)
                        .map(item => item.solve);
                });
            }
        }, (error) => {
            console.log("Snapshot error (likely permission/sign-out):", error.message);
        });

        return () => unsubscribe();
    }, [user]);

    const syncToCloud = async (solve: Solve, action: 'add' | 'update' | 'delete') => {
        if (!user) return;

        // Immediately add to persistent offline queue
        addToPendingQueue(solve, action);

        // If offline, don't attempt network call right now; processPendingQueue will handle it when online
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setSyncStatus('idle');
            return;
        }

        setSyncStatus('syncing');

        try {
            if (action === 'delete') {
                await deleteDoc(doc(db, 'solves', solve.id));
            } else {
                // Sanitize undefined values
                const dataToSave: any = {
                    ...solve,
                    userId: user.uid,
                    updatedAt: serverTimestamp()
                };
                Object.keys(dataToSave).forEach(key => {
                    if (dataToSave[key] === undefined) delete dataToSave[key];
                });
                await setDoc(doc(db, 'solves', solve.id), dataToSave);
            }
            // Remove from offline queue once synced successfully
            removeFromPendingQueue(solve.id);
            setSyncStatus('synced');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            console.error("Sync error (queued for later):", e);
            setSyncStatus('error');
        }
    };

    // Statistics Calculation
    const activeSolves = solves;

    const [userStats, setUserStats] = useState<any | null>(null);

    useEffect(() => {
        if (!user) {
            setUserStats(null);
            return;
        }
        const statsRef = doc(db, 'users', user.uid, 'stats', 'overview');
        const unsubscribe = onSnapshot(statsRef, (snap) => {
            if (snap.exists()) {
                setUserStats(snap.data());
            } else {
                setUserStats(null);
            }
        });
        return () => unsubscribe();
    }, [user]);

    const stats: Stats = useMemo(() => {
        const targetScrambleType = activeSolves[0]?.scrambleType || '333';
        const eventSolves = activeSolves.filter(s => (s.scrambleType || '333') === targetScrambleType);

        if (eventSolves.length === 0) {
            return {
                current: { single: null, ao5: null, ao12: null, ao100: null },
                best: { single: null, ao5: null, ao12: null, ao100: null }
            };
        }

        const current = {
            single: calculateAverage(eventSolves, 1),
            ao5: calculateAverage(eventSolves, 5),
            ao12: calculateAverage(eventSolves, 12),
            ao100: calculateAverage(eventSolves, 100),
        };

        if (userStats && userStats.bestAverages && userStats.bestAverages[targetScrambleType]) {
            const best = userStats.bestAverages[targetScrambleType];
            return {
                current,
                best: {
                    single: best.single || null,
                    ao5: best.ao5 || null,
                    ao12: best.ao12 || null,
                    ao100: best.ao100 || null,
                }
            };
        }

        // Fallback for unauthenticated or unmigrated users
        const validSingles = eventSolves
            .map(s => {
                if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return Infinity;
                let t = s.time;
                if (s.penalty === '+2') t += 2000;
                if (s.inspectionPenalty === '+2') t += 2000;
                return t;
            })
            .filter(t => t !== Infinity);

        // Only recompute expensive best-average scans when the solve count (or
        // scramble type) changes — not on every unrelated state update.
        const cacheKey = `${targetScrambleType}_${eventSolves.length}`;
        let cachedBests = bestAverageCacheRef.current;
        if (!cachedBests || cachedBests.key !== cacheKey) {
            cachedBests = {
                key: cacheKey,
                ao5: calculateBestAverage(eventSolves, 5),
                ao12: calculateBestAverage(eventSolves, 12),
                ao100: calculateBestAverage(eventSolves, 100),
            };
            bestAverageCacheRef.current = cachedBests;
        }

        return {
            current,
            best: {
                single: validSingles.length > 0 ? Math.min(...validSingles) : null,
                ao5: cachedBests.ao5,
                ao12: cachedBests.ao12,
                ao100: cachedBests.ao100,
            }
        };
    }, [activeSolves, userStats]);

    const trimSolves = (limit: number) => {
        setSolves(prev => {
            if (prev.length > limit) {
                return prev.slice(0, limit);
            }
            return prev;
        });
    };

    const formatTime = (time: number | null): string => {
        if (time === null) return '--';
        const date = new Date(time);
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();
        const milliseconds = date.getUTCMilliseconds();
        if (minutes > 0) {
            return `${minutes}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 10).toString().padStart(2, '0')}`;
        }
        return `${seconds}.${Math.floor(milliseconds / 10).toString().padStart(2, '0')}`;
    };

    const addSolve = async (solve: Solve) => {
        let activeSessionId = currentSessionId;

        // Check for session break requirement
        const targetScrambleType = solve.scrambleType || '333';
        const eventSolves = solves.filter(s =>
            (!user || s.userId === user.uid) &&
            (s.scrambleType || '333') === targetScrambleType
        );

        // Calculate effective time of new solve
        const effTime = solve.penalty === 'DNF' || solve.inspectionPenalty === 'DNF' ? Infinity : solve.time + (solve.penalty === '+2' ? 2000 : 0) + (solve.inspectionPenalty === '+2' ? 2000 : 0);
        const currentBest = stats.best.single;

        if (effTime !== Infinity && currentBest !== null && currentBest !== 'DNF' && effTime < currentBest) {
            setPbStreak(prev => ({ single: effTime, count: (prev?.count || 0) + 1 }));
        } else if (pbStreak && pbStreak.single !== null) {
            if (pbStreak.count > 0) {
                upsertNotification({
                    id: `pb-single-${Date.now()}`,
                    type: 'record',
                    title: `New Personal Best Single!`,
                    description: pbStreak.count > 1 ? `You broke your PB ${pbStreak.count} times in a row! New PB: ${formatTime(pbStreak.single)}` : `New PB: ${formatTime(pbStreak.single)}`,
                    metadata: { recordTime: pbStreak.single }
                });
            }
            setPbStreak(null);
        }

        if (eventSolves.length > 0) {
            const lastSolve = eventSolves[0];
            const { isNewSessionNeeded } = checkSessionStatus(new Date(lastSolve.date).getTime());
            if (isNewSessionNeeded) {
                console.log("Auto-starting new session due to gap/stats.");
                await startNewSession(false);
                activeSessionId = null; // Force lazy creation below
            }
        }

        // Lazy Session Creation
        if (!activeSessionId) {
            if (user && (typeof navigator === 'undefined' || navigator.onLine)) {
                try {
                    const docRef = await addDoc(collection(db, 'sessions'), {
                        userId: user.uid,
                        startedAt: new Date().toISOString(),
                        lastActiveAt: new Date().toISOString(),
                        solveCount: 0
                    });
                    activeSessionId = docRef.id;
                    setCurrentSessionId(activeSessionId);
                } catch (e) {
                    console.error("Error creating lazy session", e);
                    activeSessionId = `local_${Date.now()}`;
                    setCurrentSessionId(activeSessionId);
                }
            } else {
                activeSessionId = `local_${Date.now()}`;
                setCurrentSessionId(activeSessionId);
            }
        }

        const solveWithSession = {
            ...solve,
            userId: user?.uid,
            sessionId: activeSessionId || undefined
        };

        // Increment Session Count
        if (activeSessionId && user) {
            updateSessionActivity(true, activeSessionId);
        }

        setSolves(prev => {
            const newSolves = [solveWithSession, ...prev];
            return newSolves;
        });

        expireRecordsCache(user?.uid || solveWithSession.userId);
        expireLogsCache(user?.uid || solveWithSession.userId);
        expireDailyVolumeCache(user?.uid || solveWithSession.userId);
        expireStreaksCache(user?.uid || solveWithSession.userId);

        // Sync to cloud
        await syncToCloud(solveWithSession, 'add');
    };

    const updateSolve = async (id: string, updates: Partial<Solve>) => {
        expireRecordsCache(user?.uid);
        expireLogsCache(user?.uid);
        expireDailyVolumeCache(user?.uid);
        expireStreaksCache(user?.uid);
        let found = false;
        setSolves(prev => prev.map(s => {
            if (s.id === id) {
                found = true;
                const updated = { ...s, ...updates };
                syncToCloud(updated, 'update'); // Fire and forget
                return updated;
            }
            return s;
        }));
        
        if (!found && user) {
            try {
                await setDoc(doc(db, 'solves', id), { ...updates, updatedAt: serverTimestamp() }, { merge: true });
            } catch (e) {
                console.warn('Failed to update older solve directly', e);
            }
        }
    };

    const deleteSolve = async (id: string) => {
        expireRecordsCache(user?.uid);
        expireLogsCache(user?.uid);
        expireDailyVolumeCache(user?.uid);
        expireStreaksCache(user?.uid);
        const solve = solves.find(s => s.id === id);
        setSolves(prev => prev.filter(s => s.id !== id));
        // Queue this ID for removal from IDB on the next debounce write
        pendingDeleteIdsRef.current.add(id);
        idbSolveCountRef.current = Math.max(0, idbSolveCountRef.current - 1);
        if (solve) {
            await syncToCloud(solve, 'delete');
        } else if (user) {
            try {
                await deleteDoc(doc(db, 'solves', id));
            } catch (e) {
                console.warn('Failed to delete older solve directly', e);
            }
        }
    };

    const clearSolves = (keepBest: boolean) => {
        expireRecordsCache(user?.uid);
        expireLogsCache(user?.uid);
        expireDailyVolumeCache(user?.uid);
        expireStreaksCache(user?.uid);
        if (!keepBest) {
            setSolves([]);
            return;
        }
        // ...
    };

    const deleteAllSolves = async () => {
        expireRecordsCache(user?.uid);
        expireLogsCache(user?.uid);
        expireDailyVolumeCache(user?.uid);
        expireStreaksCache(user?.uid);
        if (user) {
            setSyncStatus('syncing');
            try {
                // 1. Delete all solves for user in Firestore
                const solvesQuery = query(collection(db, 'solves'), where('userId', '==', user.uid));
                const solvesSnap = await getDocs(solvesQuery);
                const BATCH_SIZE = 450;
                for (let i = 0; i < solvesSnap.docs.length; i += BATCH_SIZE) {
                    const chunk = solvesSnap.docs.slice(i, i + BATCH_SIZE);
                    const batch = writeBatch(db);
                    chunk.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }

                // 2. Delete all sessions for user in Firestore
                const sessionsQuery = query(collection(db, 'sessions'), where('userId', '==', user.uid));
                const sessionsSnap = await getDocs(sessionsQuery);
                for (let i = 0; i < sessionsSnap.docs.length; i += BATCH_SIZE) {
                    const chunk = sessionsSnap.docs.slice(i, i + BATCH_SIZE);
                    const batch = writeBatch(db);
                    chunk.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }

                // 3. Clear stats overview document in Firestore
                try {
                    await deleteDoc(doc(db, 'users', user.uid, 'stats', 'overview'));
                } catch (e) {
                    console.warn("Could not delete stats overview doc:", e);
                }

                setSyncStatus('synced');
                setTimeout(() => setSyncStatus('idle'), 2000);
            } catch (err) {
                console.error("Error deleting all solves from cloud:", err);
                setSyncStatus('error');
                throw err;
            }
        }

        // 4. Wipe local storage
        del('cutter-cubing-solves').catch(console.error);
        localStorage.removeItem('cutter-cubing-pending-sync');
        localStorage.removeItem('cutter_current_session_id');

        // 5. Wipe local state
        setSolves([]);
        setCurrentSessionId(null);
        setUserStats(null);
    };

    const deleteImportedSolves = async (source: string = 'cstimer'): Promise<{ deletedCount: number }> => {
        expireRecordsCache(user?.uid);
        expireLogsCache(user?.uid);
        expireDailyVolumeCache(user?.uid);
        expireStreaksCache(user?.uid);
        const solvesToDelete = solves.filter(s => s.source === source || (typeof s.sessionId === 'string' && s.sessionId.startsWith(`${source}_`)));
        const deletedCount = solvesToDelete.length;

        const deleteIds = new Set(solvesToDelete.map(s => s.id));

        if (user) {
            setSyncStatus('syncing');
            try {
                // 1. Delete solves with this source from Firestore
                const solvesQuery = query(collection(db, 'solves'), where('userId', '==', user.uid));
                const snap = await getDocs(solvesQuery);
                const toDeleteDocs = snap.docs.filter(d => {
                    const data = d.data();
                    return data.source === source || (typeof data.sessionId === 'string' && data.sessionId.startsWith(`${source}_`));
                });

                const BATCH_SIZE = 400;
                for (let i = 0; i < toDeleteDocs.length; i += BATCH_SIZE) {
                    const chunk = toDeleteDocs.slice(i, i + BATCH_SIZE);
                    const batch = writeBatch(db);
                    chunk.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }

                // 2. Delete imported sessions from Firestore
                const sessionsQuery = query(collection(db, 'sessions'), where('userId', '==', user.uid));
                const sSnap = await getDocs(sessionsQuery);
                const toDeleteSessions = sSnap.docs.filter(d => d.id.startsWith(`${source}_`) || d.data().source === source);
                for (let i = 0; i < toDeleteSessions.length; i += BATCH_SIZE) {
                    const chunk = toDeleteSessions.slice(i, i + BATCH_SIZE);
                    const batch = writeBatch(db);
                    chunk.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }

                // 3. Trigger recalculation of user stats overview
                try {
                    const backfillFn = httpsCallable(functions, 'backfillUserStats');
                    await backfillFn();
                } catch (bfErr) {
                    console.warn('Could not call backfillUserStats after deleting imported solves:', bfErr);
                }

                setSyncStatus('synced');
                setTimeout(() => setSyncStatus('idle'), 2000);
            } catch (err) {
                console.error("Error deleting imported solves from cloud:", err);
                setSyncStatus('error');
                throw err;
            }
        }

        // Update local React state and IDB
        setSolves(prev => prev.filter(s => !deleteIds.has(s.id)));
        deleteIds.forEach(id => pendingDeleteIdsRef.current.add(id));
        idbSolveCountRef.current = Math.max(0, idbSolveCountRef.current - deletedCount);

        return { deletedCount };
    };

    const [currentScramble, setCurrentScrambleState] = useState<string | null>(() => {
        return localStorage.getItem('cutter-cubing-current-scramble');
    });

    const setCurrentScramble = useCallback((scramble: string) => {
        setCurrentScrambleState(scramble);
        localStorage.setItem('cutter-cubing-current-scramble', scramble);
    }, []);

    const importSolves = async (
        importedSolves: Solve[],
        options?: {
            skipDuplicates?: boolean;
            replaceExistingImports?: boolean;
            onProgress?: (processed: number, total: number) => void;
        }
    ): Promise<{ importedCount: number; skippedCount: number }> => {
        if (options?.replaceExistingImports) {
            await deleteImportedSolves('cstimer');
        }

        const skipDuplicates = options?.skipDuplicates ?? true;
        const currentList = options?.replaceExistingImports
            ? solves.filter(s => s.source !== 'cstimer' && (!s.sessionId || !s.sessionId.startsWith('cstimer_')))
            : solves;

        // Build a lookup set of existing solves for duplicate detection
        const existingKeySet = new Set<string>();
        for (const s of currentList) {
            const dateRounded = Math.floor(new Date(s.date).getTime() / 1000);
            existingKeySet.add(`${s.scramble}_${dateRounded}_${s.time}`);
        }

        const solvesToInsert: Solve[] = [];
        let skippedCount = 0;

        for (const rawSolve of importedSolves) {
            const dateRounded = Math.floor(new Date(rawSolve.date).getTime() / 1000);
            const key = `${rawSolve.scramble}_${dateRounded}_${rawSolve.time}`;

            if (skipDuplicates && existingKeySet.has(key)) {
                skippedCount++;
                continue;
            }

            // Mark as seen so duplicates within the imported set itself are also deduped
            existingKeySet.add(key);

            const solveToSave: Solve = {
                ...rawSolve,
                id: rawSolve.id || crypto.randomUUID(),
                userId: user?.uid,
                penalty: rawSolve.penalty || 'none',
                inspectionPenalty: rawSolve.inspectionPenalty || 'none',
                source: rawSolve.source || 'cstimer'
            };

            solvesToInsert.push(solveToSave);
        }

        if (solvesToInsert.length === 0) {
            return { importedCount: 0, skippedCount };
        }

        // If user is logged in, sync to Firestore in chunks of 250
        if (user) {
            setSyncStatus('syncing');
            const BATCH_SIZE = 250;
            const total = solvesToInsert.length;

            try {
                // Group sessions to create session documents
                const sessionMap = new Map<string, { startedAt: string; lastActiveAt: string; count: number }>();
                for (const s of solvesToInsert) {
                    if (!s.sessionId) continue;
                    const existing = sessionMap.get(s.sessionId);
                    if (!existing) {
                        sessionMap.set(s.sessionId, { startedAt: s.date, lastActiveAt: s.date, count: 1 });
                    } else {
                        existing.count++;
                        if (new Date(s.date) < new Date(existing.startedAt)) existing.startedAt = s.date;
                        if (new Date(s.date) > new Date(existing.lastActiveAt)) existing.lastActiveAt = s.date;
                    }
                }

                // Batch write sessions (if any)
                if (sessionMap.size > 0) {
                    const sessionBatch = writeBatch(db);
                    for (const [sid, sdata] of sessionMap.entries()) {
                        const sRef = doc(db, 'sessions', sid);
                        sessionBatch.set(sRef, {
                            userId: user.uid,
                            startedAt: sdata.startedAt,
                            lastActiveAt: sdata.lastActiveAt,
                            solveCount: sdata.count,
                            source: 'cstimer',
                            updatedAt: serverTimestamp()
                        }, { merge: true });
                    }
                    await sessionBatch.commit();
                }

                // Batch write solves
                for (let i = 0; i < total; i += BATCH_SIZE) {
                    const chunk = solvesToInsert.slice(i, i + BATCH_SIZE);
                    const batch = writeBatch(db);

                    for (const s of chunk) {
                        const ref = doc(db, 'solves', s.id);
                        const dataToSave: any = {
                            ...s,
                            userId: user.uid,
                            updatedAt: serverTimestamp()
                        };
                        Object.keys(dataToSave).forEach(key => {
                            if (dataToSave[key] === undefined) delete dataToSave[key];
                        });
                        batch.set(ref, dataToSave);
                    }

                    let attempt = 0;
                    const maxAttempts = 3;
                    while (attempt < maxAttempts) {
                        try {
                            await batch.commit();
                            break;
                        } catch (err: any) {
                            attempt++;
                            if (attempt >= maxAttempts) throw err;
                            
                            const delayMs = Math.pow(2, attempt - 1) * 1000;
                            console.warn(`Batch commit failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`, err);
                            await new Promise(r => setTimeout(r, delayMs));
                        }
                    }

                    await new Promise(r => setTimeout(r, 200));

                    options?.onProgress?.(Math.min(i + BATCH_SIZE, total), total);
                }

                // Trigger recalculation of user stats overview
                try {
                    const backfillFn = httpsCallable(functions, 'backfillUserStats');
                    await backfillFn();
                } catch (bfErr) {
                    console.warn('Could not trigger backfillUserStats after import:', bfErr);
                }

                setSyncStatus('synced');
                setTimeout(() => setSyncStatus('idle'), 2000);
            } catch (e) {
                console.error("Batch import error in Firestore", e);
                setSyncStatus('error');
                throw e;
            }
        }

        // Update local React state: keep at most 100 recent solves in memory (server holds the full history)
        setSolves(prev => {
            const baseList = options?.replaceExistingImports
                ? prev.filter(s => s.source !== 'cstimer' && (!s.sessionId || !s.sessionId.startsWith('cstimer_')))
                : prev;
            const merged = [...solvesToInsert, ...baseList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return merged.slice(0, 100);
        });

        expireRecordsCache(user?.uid);
        expireLogsCache(user?.uid);
        expireDailyVolumeCache(user?.uid);
        expireStreaksCache(user?.uid);

        return { importedCount: solvesToInsert.length, skippedCount };
    };

    return (
        <SolvesContext.Provider value={{
            solves: activeSolves,
            stats,
            userStats,
            currentScramble,
            setCurrentScramble,
            addSolve,
            updateSolve,
            deleteSolve,
            clearSolves,
            deleteAllSolves,
            deleteImportedSolves,
            trimSolves,
            syncStatus,
            importSolves
        }}>
            {children}
        </SolvesContext.Provider>
    );
}

export function useSolves() {
    const context = useContext(SolvesContext);
    if (context === undefined) {
        throw new Error('useSolves must be used within a SolvesProvider');
    }
    return context;
}


