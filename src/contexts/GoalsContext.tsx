import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useSolves } from './SolvesContext';
import { useIsMobile } from '../utils/useIsMobile';
import { doc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { GoalProgress, GoalCategory, GlobalGoalsStats, UserGoalsDoc } from '../types/goals';
import { GOAL_DEFINITIONS, evaluateUserGoals, ALL_TRACKED_KEYBINDS } from '../utils/goalsCalculations';
import { Award, Clock, Layers, Flame } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface GoalsContextType {
    goalsProgress: GoalProgress[];
    completedGoalIds: Set<string>;
    pinnedGoalIds: string[];
    pinnedGoals: GoalProgress[];
    totalGoalsCount: number;
    totalCompletedCount: number;
    overallCompletionPercent: number;
    globalStats: GlobalGoalsStats | null;
    recentlyEarnedGoal: GoalProgress | null;
    hasUnseenGoals: boolean;
    clearUnseenGoals: () => void;
    selectedCategory: GoalCategory | 'all';
    setSelectedCategory: (category: GoalCategory | 'all') => void;
    statusFilter: 'all' | 'completed' | 'in-progress';
    setStatusFilter: (status: 'all' | 'completed' | 'in-progress') => void;
    recordKeybind: (key: string) => void;
    dismissRecentlyEarnedGoal: () => void;
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

const GoalsContext = createContext<GoalsContextType | undefined>(undefined);

export function GoalsProvider({ children }: { children: ReactNode }) {
    const location = useLocation();
    const isMobile = useIsMobile();
    const { user } = useAuth();
    const { solves, isPrivateMode } = useSolves();

    const [hasUnseenGoals, setHasUnseenGoals] = useState<boolean>(() => {
        return localStorage.getItem('cutter-cubing-has-unseen-goals') === 'true';
    });

    const clearUnseenGoals = useCallback(() => {
        setHasUnseenGoals(false);
        localStorage.removeItem('cutter-cubing-has-unseen-goals');
    }, []);

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
        const stored = localStorage.getItem('cutter-cubing-pinned-goals');
        return stored ? JSON.parse(stored) : [];
    });

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
    const lastSyncedGoalsRef = useRef<{ completedIds: string[]; completedCount: number } | null>(null);

    // Compute user goals progress from solves, user, and keybinds
    const userSolves = useMemo(() => {
        if (!user || isPrivateMode) return [];
        return solves.filter(s => s.userId === user.uid);
    }, [solves, user, isPrivateMode]);

    const goalsProgress = useMemo(() => {
        if (!user) {
            // When not signed in, evaluate with empty solves so definitions are available
            return evaluateUserGoals([], null, usedKeybinds);
        }
        return evaluateUserGoals(userSolves, user, usedKeybinds);
    }, [user, userSolves, usedKeybinds]);

    const completedGoalIds = useMemo(() => {
        const set = new Set<string>();
        goalsProgress.forEach(g => {
            if (g.completed) set.add(g.goalId);
        });
        return set;
    }, [goalsProgress]);

    // Visual cue for earned goals
    const [recentlyEarnedGoal, setRecentlyEarnedGoal] = useState<GoalProgress | null>(null);
    const prevCompletedIdsRef = useRef<Set<string> | null>(null);
    const isInitialLoadRef = useRef(true);

    useEffect(() => {
        if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            prevCompletedIdsRef.current = new Set(completedGoalIds);
            return;
        }

        const prev = prevCompletedIdsRef.current || new Set<string>();
        for (const goalId of completedGoalIds) {
            if (!prev.has(goalId)) {
                const goal = goalsProgress.find(g => g.goalId === goalId);
                if (goal) {
                    setRecentlyEarnedGoal(goal);
                    setHasUnseenGoals(true);
                    localStorage.setItem('cutter-cubing-has-unseen-goals', 'true');
                    prevCompletedIdsRef.current = new Set(completedGoalIds);
                    break;
                }
            }
        }
        prevCompletedIdsRef.current = new Set(completedGoalIds);
    }, [completedGoalIds, goalsProgress]);

    const dismissRecentlyEarnedGoal = useCallback(() => {
        setRecentlyEarnedGoal(null);
    }, []);

    // Dismiss goal popup on any route change
    useEffect(() => {
        setRecentlyEarnedGoal(null);
    }, [location.pathname]);

    // Close goal popup with Escape key
    useEffect(() => {
        if (!recentlyEarnedGoal) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setRecentlyEarnedGoal(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [recentlyEarnedGoal]);

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
            setPinnedGoalIds([]);
            lastSyncedGoalsRef.current = null;
            return;
        }

        const userGoalsRef = doc(db, 'users', user.uid, 'goals', 'progress');
        const unsubscribe = onSnapshot(userGoalsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as Partial<UserGoalsDoc>;
                if (Array.isArray(data.pinnedGoalIds)) {
                    setPinnedGoalIds(data.pinnedGoalIds);
                    localStorage.setItem('cutter-cubing-pinned-goals', JSON.stringify(data.pinnedGoalIds));
                }
                if (data.categoryFilter) {
                    setSelectedCategoryState(data.categoryFilter);
                    localStorage.setItem('cutter-cubing-goals-category', data.categoryFilter);
                }
                if (data.statusFilter) {
                    setStatusFilterState(data.statusFilter);
                    localStorage.setItem('cutter-cubing-goals-status', data.statusFilter);
                }
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

    // Sync user progress & update global stats transactionally
    useEffect(() => {
        if (!user || isPrivateMode) return;

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
                const userDocPayload: UserGoalsDoc = {
                    completedGoalIds: currentCompletedIds,
                    pinnedGoalIds,
                    totalCompleted: currentCompletedCount,
                    completionPercentage: overallCompletionPercent,
                    categoryFilter: selectedCategory,
                    statusFilter: statusFilter,
                    updatedAt: new Date().toISOString()
                };

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

                    if (!userSnap.exists()) {
                        statsData.totalUsers = (statsData.totalUsers || 0) + 1;
                    } else {
                        const prevData = userSnap.data() as Partial<UserGoalsDoc>;
                        prevCompletedIds = Array.isArray(prevData.completedGoalIds) ? prevData.completedGoalIds : [];
                        prevCount = typeof prevData.totalCompleted === 'number' ? prevData.totalCompleted : prevCompletedIds.length;
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
    }, [user, isPrivateMode, completedGoalIds, overallCompletionPercent, pinnedGoalIds, selectedCategory, statusFilter]);

    const pinGoal = useCallback(async (goalId: string): Promise<boolean> => {
        if (pinnedGoalIds.includes(goalId)) return true;
        if (pinnedGoalIds.length >= 3) {
            return false;
        }

        const next = [...pinnedGoalIds, goalId];
        setPinnedGoalIds(next);
        localStorage.setItem('cutter-cubing-pinned-goals', JSON.stringify(next));

        if (user) {
            try {
                const userGoalsRef = doc(db, 'users', user.uid, 'goals', 'progress');
                await setDoc(userGoalsRef, { pinnedGoalIds: next }, { merge: true });
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

        if (user) {
            try {
                const userGoalsRef = doc(db, 'users', user.uid, 'goals', 'progress');
                await setDoc(userGoalsRef, { pinnedGoalIds: next }, { merge: true });
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
                recentlyEarnedGoal,
                hasUnseenGoals,
                clearUnseenGoals,
                selectedCategory,
                setSelectedCategory,
                statusFilter,
                setStatusFilter,
                recordKeybind,
                dismissRecentlyEarnedGoal,
                getGoalGlobalPercentage,
                getGoalProgress,
                pinGoal,
                unpinGoal,
                isGoalPinned,
                getGoalsByCategory
            }}
        >
            {children}

            {/* Visual Cue when user earns a goal */}
            {recentlyEarnedGoal && !isMobile && (
                <div className="fixed top-16 right-6 z-50 animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto">
                    <div className="bg-bg-secondary/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-xl p-3 flex items-center gap-3 min-w-[260px] max-w-sm">
                        <div className="w-8 h-8 rounded-lg bg-bg-tertiary border border-border/70 flex items-center justify-center text-text-primary shrink-0">
                            {getGoalCategoryIcon(recentlyEarnedGoal.category)}
                        </div>
                        <div className="flex-1 min-w-0 pr-1">
                            <h4 className="text-xs font-bold text-text-primary truncate">
                                {recentlyEarnedGoal.title}
                            </h4>
                            <p className="text-[11px] text-text-secondary line-clamp-2 mt-0.5 leading-snug">
                                {recentlyEarnedGoal.description}
                            </p>
                        </div>
                        <button
                            onClick={dismissRecentlyEarnedGoal}
                            className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-border/80 rounded transition-colors cursor-pointer shrink-0 self-center"
                            title="Close (ESC)"
                        >
                            ESC
                        </button>
                    </div>
                </div>
            )}
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
