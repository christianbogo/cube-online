import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useSolves } from './SolvesContext';
import { doc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { GoalProgress, GoalCategory, GlobalGoalsStats, UserGoalsDoc } from '../types/goals';
import { GOAL_DEFINITIONS, evaluateUserGoals } from '../utils/goalsCalculations';

interface GoalsContextType {
    goalsProgress: GoalProgress[];
    completedGoalIds: Set<string>;
    pinnedGoalIds: string[];
    pinnedGoals: GoalProgress[];
    totalGoalsCount: number;
    totalCompletedCount: number;
    overallCompletionPercent: number;
    globalStats: GlobalGoalsStats | null;
    getGoalGlobalPercentage: (goalId: string) => number;
    getGoalProgress: (goalId: string) => GoalProgress | undefined;
    pinGoal: (goalId: string) => Promise<boolean>;
    unpinGoal: (goalId: string) => Promise<void>;
    isGoalPinned: (goalId: string) => boolean;
    getGoalsByCategory: (category: GoalCategory) => GoalProgress[];
}

const GoalsContext = createContext<GoalsContextType | undefined>(undefined);

export function GoalsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { solves, isPrivateMode } = useSolves();

    const [pinnedGoalIds, setPinnedGoalIds] = useState<string[]>(() => {
        const stored = localStorage.getItem('cutter-cubing-pinned-goals');
        return stored ? JSON.parse(stored) : [];
    });

    const [globalStats, setGlobalStats] = useState<GlobalGoalsStats | null>(null);
    const lastSyncedGoalsRef = useRef<{ completedIds: string[]; completedCount: number } | null>(null);

    // Compute user goals progress from solves
    const userSolves = useMemo(() => {
        if (!user || isPrivateMode) return [];
        return solves.filter(s => s.userId === user.uid);
    }, [solves, user, isPrivateMode]);

    const goalsProgress = useMemo(() => {
        if (!user) {
            // When not signed in, evaluate with empty solves so definitions are available
            return evaluateUserGoals([]);
        }
        return evaluateUserGoals(userSolves);
    }, [user, userSolves]);

    const completedGoalIds = useMemo(() => {
        const set = new Set<string>();
        goalsProgress.forEach(g => {
            if (g.completed) set.add(g.goalId);
        });
        return set;
    }, [goalsProgress]);

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
            }
        }, (err) => {
            console.warn("Goals snapshot warning:", err.message);
        });

        return () => unsubscribe();
    }, [user]);

    // Listen to global goals stats document
    useEffect(() => {
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
    }, []);

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
                // 1. Update user goals doc
                const userDocPayload: UserGoalsDoc = {
                    completedGoalIds: currentCompletedIds,
                    pinnedGoalIds,
                    totalCompleted: currentCompletedCount,
                    completionPercentage: overallCompletionPercent,
                    updatedAt: new Date().toISOString()
                };
                await setDoc(userGoalsRef, userDocPayload, { merge: true });

                // 2. Transactionally update global stats
                await runTransaction(db, async (transaction) => {
                    const statsSnap = await transaction.get(globalStatsRef);
                    let statsData: GlobalGoalsStats;

                    if (!statsSnap.exists()) {
                        statsData = {
                            totalUsers: 1,
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

                    const prevCompleted = last ? new Set(last.completedIds) : new Set<string>();
                    const isNewUserRecord = !last;

                    if (isNewUserRecord) {
                        // Check if user was previously tracked
                        const userCheck = await transaction.get(userGoalsRef);
                        if (!userCheck.exists()) {
                            statsData.totalUsers = (statsData.totalUsers || 0) + 1;
                        }
                    }

                    // Remove previous counts if user completed count changed
                    if (last) {
                        const prevCount = last.completedCount;
                        if (statsData.totalGoalsCountDistribution[prevCount] !== undefined) {
                            statsData.totalGoalsCountDistribution[prevCount] = Math.max(0, statsData.totalGoalsCountDistribution[prevCount] - 1);
                        }
                    }

                    // Add new count distribution
                    statsData.totalGoalsCountDistribution[currentCompletedCount] =
                        (statsData.totalGoalsCountDistribution[currentCompletedCount] || 0) + 1;

                    // Goal-level diffs
                    GOAL_DEFINITIONS.forEach(def => {
                        const wasCompleted = prevCompleted.has(def.id);
                        const isCompleted = completedGoalIds.has(def.id);

                        const curCount = statsData.goalCompletionCounts[def.id] || 0;
                        if (!wasCompleted && isCompleted) {
                            statsData.goalCompletionCounts[def.id] = curCount + 1;
                        } else if (wasCompleted && !isCompleted) {
                            statsData.goalCompletionCounts[def.id] = Math.max(0, curCount - 1);
                        }
                    });

                    // Recalculate percentages
                    const totalUsers = Math.max(1, statsData.totalUsers || 1);
                    const percentages: Record<string, number> = {};
                    Object.entries(statsData.goalCompletionCounts).forEach(([gId, c]) => {
                        percentages[gId] = Math.round((c / totalUsers) * 1000) / 10;
                    });
                    statsData.goalCompletionPercentages = percentages;
                    statsData.updatedAt = new Date().toISOString();

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
    }, [user, isPrivateMode, completedGoalIds, overallCompletionPercent, pinnedGoalIds]);

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
        return globalStats.goalCompletionPercentages[goalId] || 0;
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
