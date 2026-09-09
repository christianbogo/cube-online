import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useSolves } from './SolvesContext';
import { useNotifications } from './NotificationsContext';
import { useIsMobile } from '../utils/useIsMobile';
import { doc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { GoalProgress, GoalCategory, GlobalGoalsStats, UserGoalsDoc, UserStats } from '../types/goals';
import { GOAL_DEFINITIONS, evaluateUserGoals, ALL_TRACKED_KEYBINDS } from '../utils/goalsCalculations';
import { Award, Clock, Layers, Flame, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import {
    getCachedStreaksSync,
    getCachedStreaks,
    setCachedStreaks,
    STREAKS_CACHE_EXPIRED_EVENT,
    type StreaksMap
} from '../utils/streaksCache';

interface GoalsContextType {
    goalsProgress: GoalProgress[];
    completedGoalIds: Set<string>;
    pinnedGoalIds: string[];
    pinnedGoals: GoalProgress[];
    totalGoalsCount: number;
    totalCompletedCount: number;
    overallCompletionPercent: number;
    globalStats: GlobalGoalsStats | null;
    hasUnseenGoals: boolean;
    clearUnseenGoals: () => void;
    selectedCategory: GoalCategory | 'all';
    setSelectedCategory: (category: GoalCategory | 'all') => void;
    statusFilter: 'all' | 'completed' | 'in-progress';
    setStatusFilter: (status: 'all' | 'completed' | 'in-progress') => void;
    recordKeybind: (key: string) => void;
    getGoalGlobalPercentage: (goalId: string) => number;
    getGoalProgress: (goalId: string) => GoalProgress | undefined;
    pinGoal: (goalId: string) => Promise<boolean>;
    unpinGoal: (goalId: string) => Promise<void>;
    isGoalPinned: (goalId: string) => boolean;
    getGoalsByCategory: (category: GoalCategory) => GoalProgress[];
}

function getGoalCategoryIcon(category?: GoalCategory) {
    switch (category) {
        case 'time':
            return <Clock className="w-4 h-4" />;
        case 'count':
            return <Layers className="w-4 h-4" />;
        case 'streak':
            return <Flame className="w-4 h-4" />;
        case 'diversity':
        default:
            return <Award className="w-4 h-4" />;
    }
}

const getDismissedGoalsKey = (uid?: string | null) => `cutter-cubing-dismissed-goals_${uid || 'guest'}`;
const getHasUnseenGoalsKey = (uid?: string | null) => `cutter-cubing-has-unseen-goals_${uid || 'guest'}`;

const getDismissedGoals = (uid?: string | null): Set<string> => {
    try {
        const raw = localStorage.getItem(getDismissedGoalsKey(uid));
        return raw ? new Set(JSON.parse(raw)) : new Set<string>();
    } catch {
        return new Set<string>();
    }
};

const saveDismissedGoals = (uid: string | null | undefined, ids: Set<string>) => {
    try {
        localStorage.setItem(getDismissedGoalsKey(uid), JSON.stringify(Array.from(ids)));
    } catch (e) {
        console.warn("Failed to persist dismissed goals:", e);
    }
};

const GoalsContext = createContext<GoalsContextType | undefined>(undefined);

export function GoalsProvider({ children }: { children: ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { user, loading: authLoading } = useAuth();
    const { solves } = useSolves();

    const [hasUnseenGoals, setHasUnseenGoals] = useState<boolean>(() => {
        return localStorage.getItem(getHasUnseenGoalsKey(user?.uid)) === 'true';
    });

    const clearUnseenGoals = useCallback(() => {
        setHasUnseenGoals(false);
        try {
            localStorage.removeItem(getHasUnseenGoalsKey(user?.uid));
            localStorage.removeItem('cutter-cubing-has-unseen-goals');
        } catch {
            // Ignore storage errors
        }
    }, [user?.uid]);

    // Clear unseen indicator whenever user views the Goals page
    useEffect(() => {
        if (location.pathname === '/goals') {
            clearUnseenGoals();
        }
    }, [location.pathname, clearUnseenGoals]);

    const [selectedCategory, setSelectedCategoryState] = useState<GoalCategory | 'all'>(() => {
        const stored = localStorage.getItem('cutter-cubing-goals-category');
        return (stored as GoalCategory | 'all') || 'all';
    });

    const [statusFilter, setStatusFilterState] = useState<'all' | 'completed' | 'in-progress'>(() => {
        const stored = localStorage.getItem('cutter-cubing-goals-status');
        return (stored as 'all' | 'completed' | 'in-progress') || 'all';
    });

    const setSelectedCategory = useCallback((cat: GoalCategory | 'all') => {
        setSelectedCategoryState(cat);
        localStorage.setItem('cutter-cubing-goals-category', cat);
        if (user) {
            const userGoalsRef = doc(db, 'users', user.uid, 'goals', 'progress');
            setDoc(userGoalsRef, { categoryFilter: cat, updatedAt: new Date().toISOString() }, { merge: true }).catch(err => {
                console.warn("Error saving category filter to account:", err);
            });
        }
    }, [user]);

    const setStatusFilter = useCallback((status: 'all' | 'completed' | 'in-progress') => {
        setStatusFilterState(status);
        localStorage.setItem('cutter-cubing-goals-status', status);
        if (user) {
            const userGoalsRef = doc(db, 'users', user.uid, 'goals', 'progress');
            setDoc(userGoalsRef, { statusFilter: status, updatedAt: new Date().toISOString() }, { merge: true }).catch(err => {
                console.warn("Error saving status filter to account:", err);
            });
        }
    }, [user]);

    const [pinnedGoalIds, setPinnedGoalIds] = useState<string[]>(() => {
        if (user && Array.isArray(user.pinnedGoalIds) && user.pinnedGoalIds.length > 0) {
            return user.pinnedGoalIds;
        }
        const stored = localStorage.getItem('cutter-cubing-pinned-goals');
        return stored ? JSON.parse(stored) : [];
    });

    const prevUserIdRef = useRef<string | null>(user?.uid || null);

    useEffect(() => {
        if (user && Array.isArray(user.pinnedGoalIds) && user.pinnedGoalIds.length > 0) {
            queueMicrotask(() => {
                setPinnedGoalIds(prev => {
                    if (prev.length === 0) {
                        localStorage.setItem('cutter-cubing-pinned-goals', JSON.stringify(user.pinnedGoalIds));
                        return user.pinnedGoalIds!;
                    }
                    return prev;
                });
            });
        }
    }, [user]);

    const [usedKeybinds, setUsedKeybinds] = useState<string[]>(() => {
        const stored = localStorage.getItem('cutter-cubing-used-keybinds');
        return stored ? JSON.parse(stored) : [];
    });

    const recordKeybind = useCallback((key: string) => {
        const match = ALL_TRACKED_KEYBINDS.find(k => k.toLowerCase() === key.toLowerCase());
        if (!match) return;

        setUsedKeybinds(prev => {
            if (prev.includes(match)) return prev;
            const updated = [...prev, match];
            localStorage.setItem('cutter-cubing-used-keybinds', JSON.stringify(updated));
            return updated;
        });
    }, []);

    // Global Keydown listener for keybind tracking
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) {
                return;
            }
            if (e.code === 'Space') {
                recordKeybind('Space');
            } else if (e.key) {
                recordKeybind(e.key);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [recordKeybind]);

    const [globalStats, setGlobalStats] = useState<GlobalGoalsStats | null>(null);
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const lastSyncedGoalsRef = useRef<{ completedIds: string[]; completedCount: number } | null>(null);
    const userStatsLoadedRef = useRef(false);

    // Subscribe to userStats
    useEffect(() => {
        if (!user || authLoading) {
            if (!authLoading) {
                setUserStats(null);
                userStatsLoadedRef.current = false;
            }
            return;
        }
        const statsRef = doc(db, 'users', user.uid, 'stats', 'overview');
        const unsubscribe = onSnapshot(statsRef, (snap) => {
            userStatsLoadedRef.current = true;
            if (snap.exists()) {
                setUserStats(snap.data() as UserStats);
            } else {
                setUserStats(null);
            }
        });
        return () => unsubscribe();
    }, [user, authLoading]);

    const [streakStats, setStreakStats] = useState<StreaksMap | null>(() => {
        return getCachedStreaksSync(user?.uid);
    });

    useEffect(() => {
        if (!user || authLoading) {
            if (!authLoading) setStreakStats(null);
            return;
        }

        let isMounted = true;
        const fetchStreaks = async (force = false) => {
            if (!force) {
                const cached = await getCachedStreaks(user.uid);
                if (cached && isMounted) {
                    setStreakStats(cached);
                    return;
                }
            }
            try {
                const fn = httpsCallable(functions, 'getGoalStreaks');
                const res = await fn();
                const data = (res.data as { streaks: StreaksMap }).streaks;
                if (isMounted) {
                    setStreakStats(data);
                    await setCachedStreaks(user.uid, data);
                }
            } catch (e) {
                console.warn('Failed to evaluate streaks from server:', e);
            }
        };

        fetchStreaks();

        const handleExpired = () => {
            fetchStreaks(true);
        };

        window.addEventListener(STREAKS_CACHE_EXPIRED_EVENT, handleExpired);
        return () => {
            isMounted = false;
            window.removeEventListener(STREAKS_CACHE_EXPIRED_EVENT, handleExpired);
        };
    }, [user?.uid, authLoading]);

    // Compute user goals progress from solves, user, and keybinds
    const userSolves = useMemo(() => {
        if (!user) return [];
        return solves.filter(s => s.userId === user.uid);
    }, [solves, user]);

    const goalsProgress = useMemo(() => {
        if (!user) {
            // When not signed in, evaluate with empty solves so definitions are available
            return evaluateUserGoals([], null, usedKeybinds, null, null);
        }
        // Don't run the expensive local fallback while Firestore stats haven't arrived yet
        if (!userStatsLoadedRef.current) return [];
        return evaluateUserGoals(userSolves, user, usedKeybinds, userStats, streakStats);
    }, [user, userSolves, usedKeybinds, userStats, streakStats]);

    const completedGoalIds = useMemo(() => {
        const set = new Set<string>();
        goalsProgress.forEach(g => {
            if (g.completed) set.add(g.goalId);
        });
        return set;
    }, [goalsProgress]);

    const { upsertNotification, removeNotification } = useNotifications();
    const baselineInitializedRef = useRef<boolean>(false);
    const baselineUserIdRef = useRef<string | null>(null);
    const prevCompletedIdsRef = useRef<Set<string>>(new Set());
    const dismissedGoalsRef = useRef<Set<string>>(getDismissedGoals(user?.uid));

    // Reset baseline tracking when user changes (login, logout, switch account)
    useEffect(() => {
        const currentUid = user?.uid ?? null;
        if (baselineUserIdRef.current !== currentUid) {
            baselineUserIdRef.current = currentUid;
            baselineInitializedRef.current = false;
            prevCompletedIdsRef.current = new Set();
            dismissedGoalsRef.current = getDismissedGoals(currentUid);
            try {
                setHasUnseenGoals(localStorage.getItem(getHasUnseenGoalsKey(currentUid)) === 'true');
            } catch {
                setHasUnseenGoals(false);
            }
        }
    }, [user?.uid]);

    // Track completed goals and detect newly earned ones (and regressions)
    useEffect(() => {
        if (!baselineInitializedRef.current) {
            if (user && !userStatsLoadedRef.current) {
                // Wait until user stats from Firestore have loaded before establishing baseline
                return;
            }
            baselineInitializedRef.current = true;
            prevCompletedIdsRef.current = new Set(completedGoalIds);
            // Pre-existing completed goals are registered as known so they don't pop up on refresh
            completedGoalIds.forEach(id => dismissedGoalsRef.current.add(id));
            saveDismissedGoals(user?.uid, dismissedGoalsRef.current);
            return;
        }

        const prev = prevCompletedIdsRef.current;
        const dismissed = dismissedGoalsRef.current;
        let hasNewGoals = false;

        for (const goalId of completedGoalIds) {
            if (!prev.has(goalId)) {
                const goal = goalsProgress.find(g => g.goalId === goalId);
                if (goal) {
                    upsertNotification({
                        id: `goal-${goal.goalId}`,
                        type: 'goal',
                        title: `Goal Unlocked: ${goal.title}`,
                        description: goal.description,
                        metadata: { goalId: goal.goalId }
                    });
                    dismissed.add(goalId);
                    hasNewGoals = true;
                }
            }
        }

        for (const goalId of prev) {
            if (!completedGoalIds.has(goalId)) {
                removeNotification(`goal-${goalId}`);
                dismissed.delete(goalId);
            }
        }

        prevCompletedIdsRef.current = new Set(completedGoalIds);

        if (hasNewGoals) {
            saveDismissedGoals(user?.uid, dismissed);
            setHasUnseenGoals(true);
            try {
                localStorage.setItem(getHasUnseenGoalsKey(user?.uid), 'true');
            } catch (e) {
                console.warn("Failed to persist unseen goals flag:", e);
            }
        }
    }, [completedGoalIds, goalsProgress, user, upsertNotification, removeNotification]);

    const dismissRecentlyEarnedGoal = useCallback(() => {}, []);

    const totalGoalsCount = GOAL_DEFINITIONS.length;
    const totalCompletedCount = completedGoalIds.size;
    const overallCompletionPercent = totalGoalsCount > 0
        ? Math.round((totalCompletedCount / totalGoalsCount) * 1000) / 10
        : 0;

    const pinnedGoals = useMemo(() => {
        return pinnedGoalIds
            .map(id => goalsProgress.find(g => g.goalId === id))
            .filter((g): g is GoalProgress => g !== undefined);
    }, [pinnedGoalIds, goalsProgress]);

    // Load initial user goals document from Firestore when auth loads
    useEffect(() => {
        if (!user) {
            // Only clear state if user explicitly logged out from an active session
            if (prevUserIdRef.current !== null) {
                localStorage.removeItem('cutter-cubing-pinned-goals');
                queueMicrotask(() => {
                    setPinnedGoalIds([]);
                });
            }
            prevUserIdRef.current = null;
            lastSyncedGoalsRef.current = null;
            return;
        }

        prevUserIdRef.current = user.uid;
        const userGoalsRef = doc(db, 'users', user.uid, 'goals', 'progress');
        const unsubscribe = onSnapshot(userGoalsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as Partial<UserGoalsDoc>;
                if (Array.isArray(data.pinnedGoalIds)) {
                    setPinnedGoalIds(data.pinnedGoalIds);
                    localStorage.setItem('cutter-cubing-pinned-goals', JSON.stringify(data.pinnedGoalIds));
                } else if (Array.isArray(user.pinnedGoalIds) && user.pinnedGoalIds.length > 0) {
                    setPinnedGoalIds(user.pinnedGoalIds);
                    localStorage.setItem('cutter-cubing-pinned-goals', JSON.stringify(user.pinnedGoalIds));
                    setDoc(userGoalsRef, { pinnedGoalIds: user.pinnedGoalIds }, { merge: true }).catch(() => {});
                }
                if (data.categoryFilter) {
                    setSelectedCategoryState(data.categoryFilter);
                    localStorage.setItem('cutter-cubing-goals-category', data.categoryFilter);
                }
                if (data.statusFilter) {
                    setStatusFilterState(data.statusFilter);
                    localStorage.setItem('cutter-cubing-goals-status', data.statusFilter);
                }
            } else if (Array.isArray(user.pinnedGoalIds) && user.pinnedGoalIds.length > 0) {
                setPinnedGoalIds(user.pinnedGoalIds);
                localStorage.setItem('cutter-cubing-pinned-goals', JSON.stringify(user.pinnedGoalIds));
            }
        }, (err) => {
            console.warn("Goals snapshot warning:", err.message);
        });

        return () => unsubscribe();
    }, [user]);

    // Listen to global goals stats document (authenticated users only)
    useEffect(() => {
        if (!user) {
            return;
        }

        const statsRef = doc(db, 'global_stats', 'goals');
        const unsubscribe = onSnapshot(statsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as GlobalGoalsStats;
                setGlobalStats(data);
            }
        }, (err) => {
            console.warn("Global goals stats snapshot warning:", err.message);
        });

        return () => unsubscribe();
    }, [user]);

    const pinnedGoalIdsRef = useRef(pinnedGoalIds);
    useEffect(() => {
        pinnedGoalIdsRef.current = pinnedGoalIds;
    }, [pinnedGoalIds]);

    // Sync user progress & update global stats transactionally
    useEffect(() => {
        if (!user) return;

        const currentCompletedIds = Array.from(completedGoalIds).sort();
        const currentCompletedCount = currentCompletedIds.length;

        // Skip if already in sync
        const last = lastSyncedGoalsRef.current;
        if (last && last.completedCount === currentCompletedCount &&
            last.completedIds.length === currentCompletedIds.length &&
            last.completedIds.every((id, idx) => id === currentCompletedIds[idx])) {
            return;
        }

        const userGoalsRef = doc(db, 'users', user.uid, 'goals', 'progress');
        const globalStatsRef = doc(db, 'global_stats', 'goals');

        const syncGoals = async () => {
            try {
                // Transactionally update both user document and global stats
                await runTransaction(db, async (transaction) => {
                    const userSnap = await transaction.get(userGoalsRef);
                    const statsSnap = await transaction.get(globalStatsRef);

                    let statsData: GlobalGoalsStats;
                    if (!statsSnap.exists()) {
                        statsData = {
                            totalUsers: 0,
                            goalCompletionCounts: {},
                            goalCompletionPercentages: {},
                            totalGoalsCountDistribution: {},
                            updatedAt: new Date().toISOString()
                        };
                    } else {
                        statsData = statsSnap.data() as GlobalGoalsStats;
                        if (!statsData.goalCompletionCounts) statsData.goalCompletionCounts = {};
                        if (!statsData.totalGoalsCountDistribution) statsData.totalGoalsCountDistribution = {};
                    }

                    let prevCompletedIds: string[] = [];
                    let prevCount: number | null = null;
                    let effectivePinnedGoalIds = pinnedGoalIdsRef.current;

                    if (!userSnap.exists()) {
                        statsData.totalUsers = (statsData.totalUsers || 0) + 1;
                        if (effectivePinnedGoalIds.length === 0 && Array.isArray(user.pinnedGoalIds) && user.pinnedGoalIds.length > 0) {
                            effectivePinnedGoalIds = user.pinnedGoalIds;
                        }
                    } else {
                        const prevData = userSnap.data() as Partial<UserGoalsDoc>;
                        prevCompletedIds = Array.isArray(prevData.completedGoalIds) ? prevData.completedGoalIds : [];
                        prevCount = typeof prevData.totalCompleted === 'number' ? prevData.totalCompleted : prevCompletedIds.length;

                        // Preserve existing pinned goals in Firestore if local state is empty
                        if (effectivePinnedGoalIds.length === 0 && Array.isArray(prevData.pinnedGoalIds) && prevData.pinnedGoalIds.length > 0) {
                            effectivePinnedGoalIds = prevData.pinnedGoalIds;
                        } else if (effectivePinnedGoalIds.length === 0 && Array.isArray(user.pinnedGoalIds) && user.pinnedGoalIds.length > 0) {
                            effectivePinnedGoalIds = user.pinnedGoalIds;
                        }
                    }

                    const userDocPayload: UserGoalsDoc = {
                        completedGoalIds: currentCompletedIds,
                        pinnedGoalIds: effectivePinnedGoalIds,
                        totalCompleted: currentCompletedCount,
                        completionPercentage: overallCompletionPercent,
                        categoryFilter: selectedCategory,
                        statusFilter: statusFilter,
                        updatedAt: new Date().toISOString()
                    };

                    if (effectivePinnedGoalIds.length > 0 && pinnedGoalIdsRef.current.length === 0) {
                        setPinnedGoalIds(effectivePinnedGoalIds);
                        localStorage.setItem('cutter-cubing-pinned-goals', JSON.stringify(effectivePinnedGoalIds));
                    }

                    const prevCompletedSet = new Set(prevCompletedIds);
                    const currentCompletedSet = new Set(currentCompletedIds);

                    const countChanged = prevCount !== currentCompletedCount;
                    const goalsChanged = prevCompletedIds.length !== currentCompletedIds.length ||
                        prevCompletedIds.some(id => !currentCompletedSet.has(id)) ||
                        currentCompletedIds.some(id => !prevCompletedSet.has(id));

                    // If user document already existed and no goals progress changed, only update user metadata
                    if (userSnap.exists() && !countChanged && !goalsChanged) {
                        transaction.set(userGoalsRef, userDocPayload, { merge: true });
                        return;
                    }

                    // Decrement previous count bucket if this user had a prior recorded count
                    if (prevCount !== null && statsData.totalGoalsCountDistribution[prevCount] !== undefined) {
                        statsData.totalGoalsCountDistribution[prevCount] = Math.max(0, statsData.totalGoalsCountDistribution[prevCount] - 1);
                    }

                    // Increment current count bucket
                    statsData.totalGoalsCountDistribution[currentCompletedCount] =
                        (statsData.totalGoalsCountDistribution[currentCompletedCount] || 0) + 1;

                    // Goal-level diffs
                    GOAL_DEFINITIONS.forEach(def => {
                        const wasCompleted = prevCompletedSet.has(def.id);
                        const isCompleted = currentCompletedSet.has(def.id);

                        const curCount = statsData.goalCompletionCounts[def.id] || 0;
                        if (!wasCompleted && isCompleted) {
                            statsData.goalCompletionCounts[def.id] = curCount + 1;
                        } else if (wasCompleted && !isCompleted) {
                            statsData.goalCompletionCounts[def.id] = Math.max(0, curCount - 1);
                        }
                    });

                    // Compute total users reliably (at least the sum of users in distribution buckets)
                    const distributionUserCount = Object.values(statsData.totalGoalsCountDistribution).reduce((sum, c) => sum + c, 0);
                    const totalUsers = Math.max(statsData.totalUsers || 0, distributionUserCount, 1);
                    statsData.totalUsers = totalUsers;

                    // Recalculate percentages (capped between 0 and 100)
                    const percentages: Record<string, number> = {};
                    Object.entries(statsData.goalCompletionCounts).forEach(([gId, c]) => {
                        const cappedCount = Math.min(c, totalUsers);
                        percentages[gId] = Math.min(100, Math.max(0, Math.round((cappedCount / totalUsers) * 1000) / 10));
                    });
                    statsData.goalCompletionPercentages = percentages;
                    statsData.updatedAt = new Date().toISOString();

                    transaction.set(userGoalsRef, userDocPayload, { merge: true });
                    transaction.set(globalStatsRef, statsData, { merge: true });
                });

                lastSyncedGoalsRef.current = {
                    completedIds: currentCompletedIds,
                    completedCount: currentCompletedCount
                };
            } catch (err) {
                console.error("Failed to sync goals to Firestore:", err);
            }
        };

        const timeout = setTimeout(syncGoals, 1000);
        return () => clearTimeout(timeout);
    }, [user, completedGoalIds, overallCompletionPercent, selectedCategory, statusFilter]);

    const pinGoal = useCallback(async (goalId: string): Promise<boolean> => {
        if (pinnedGoalIds.includes(goalId)) return true;
        if (pinnedGoalIds.length >= 3) {
            return false;
        }

        const next = [...pinnedGoalIds, goalId];
        setPinnedGoalIds(next);
        localStorage.setItem('cutter-cubing-pinned-goals', JSON.stringify(next));

        const cachedProfileStr = localStorage.getItem('cached_user_profile');
        if (cachedProfileStr) {
            try {
                const cached = JSON.parse(cachedProfileStr);
                cached.pinnedGoalIds = next;
                localStorage.setItem('cached_user_profile', JSON.stringify(cached));
            } catch (err) {
                console.debug("Failed to update cached profile:", err);
            }
        }

        if (user) {
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userGoalsRef = doc(db, 'users', user.uid, 'goals', 'progress');
                await Promise.all([
                    setDoc(userDocRef, { pinnedGoalIds: next }, { merge: true }),
                    setDoc(userGoalsRef, { pinnedGoalIds: next }, { merge: true })
                ]);
            } catch (e) {
                console.error("Failed to save pinned goal:", e);
            }
        }
        return true;
    }, [pinnedGoalIds, user]);

    const unpinGoal = useCallback(async (goalId: string) => {
        const next = pinnedGoalIds.filter(id => id !== goalId);
        setPinnedGoalIds(next);
        localStorage.setItem('cutter-cubing-pinned-goals', JSON.stringify(next));

        const cachedProfileStr = localStorage.getItem('cached_user_profile');
        if (cachedProfileStr) {
            try {
                const cached = JSON.parse(cachedProfileStr);
                cached.pinnedGoalIds = next;
                localStorage.setItem('cached_user_profile', JSON.stringify(cached));
            } catch (err) {
                console.debug("Failed to update cached profile:", err);
            }
        }

        if (user) {
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userGoalsRef = doc(db, 'users', user.uid, 'goals', 'progress');
                await Promise.all([
                    setDoc(userDocRef, { pinnedGoalIds: next }, { merge: true }),
                    setDoc(userGoalsRef, { pinnedGoalIds: next }, { merge: true })
                ]);
            } catch (e) {
                console.error("Failed to unpin goal:", e);
            }
        }
    }, [pinnedGoalIds, user]);

    const isGoalPinned = useCallback((goalId: string) => {
        return pinnedGoalIds.includes(goalId);
    }, [pinnedGoalIds]);

    const getGoalGlobalPercentage = useCallback((goalId: string) => {
        if (!globalStats || !globalStats.goalCompletionPercentages) return 0;
        const pct = globalStats.goalCompletionPercentages[goalId] || 0;
        return Math.min(100, Math.max(0, pct));
    }, [globalStats]);

    const getGoalProgress = useCallback((goalId: string) => {
        return goalsProgress.find(g => g.goalId === goalId);
    }, [goalsProgress]);

    const getGoalsByCategory = useCallback((category: GoalCategory) => {
        return goalsProgress.filter(g => g.category === category);
    }, [goalsProgress]);

    return (
        <GoalsContext.Provider
            value={{
                goalsProgress,
                completedGoalIds,
                pinnedGoalIds,
                pinnedGoals,
                totalGoalsCount,
                totalCompletedCount,
                overallCompletionPercent,
                globalStats,
                hasUnseenGoals,
                clearUnseenGoals,
                selectedCategory,
                setSelectedCategory,
                statusFilter,
                setStatusFilter,
                recordKeybind,
                getGoalGlobalPercentage,
                getGoalProgress,
                pinGoal,
                unpinGoal,
                isGoalPinned,
                getGoalsByCategory
            }}
        >
            {children}
        </GoalsContext.Provider>
    );
}

export function useGoals() {
    const context = useContext(GoalsContext);
    if (context === undefined) {
        throw new Error('useGoals must be used within a GoalsProvider');
    }
    return context;
}
