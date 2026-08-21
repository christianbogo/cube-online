import type { Solve, UserData } from '../types';
import { evaluateUserGoals } from './goalsCalculations';
import {
    calculateBestSingleRecord,
    calculateBestAverageRecord,
    getRecencyTier,
    getEffectiveTime
} from './recordCalculations';
import { SCRAMBLE_TYPES, SUPPORTED_EVENT_IDS } from './constants';

export interface LeaderboardEntry {
    rank: number;
    user: UserData;
    scoreValue: number;
    scoreDisplay: string;
    secondaryDisplay?: string;
    isCurrentUser?: boolean;
}

export interface LeaderboardSlot {
    rank: number;
    entry: LeaderboardEntry | null;
    isEmpty: boolean;
    emptyText: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;
const ONE_YEAR_MS = 365 * ONE_DAY_MS;

export function formatLeaderboardDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

// 1. Most Solving (day, week, month)
export function getMostSolvingLeaderboard(
    users: UserData[],
    solves: Solve[],
    timeframe: 'day' | 'week' | 'month',
    currentUserId?: string
): LeaderboardSlot[] {
    const now = Date.now();
    const timeframeMs = timeframe === 'day' ? ONE_DAY_MS : timeframe === 'week' ? SEVEN_DAYS_MS : THIRTY_DAYS_MS;
    const thresholdTime = now - timeframeMs;

    const userMap = new Map<string, UserData>();
    users.forEach(u => userMap.set(u.uid, u));

    // Group solves within timeframe by userId
    const timeByUser = new Map<string, { totalTime: number; count: number }>();

    solves.forEach(s => {
        if (!s.userId) return;
        const solveTime = new Date(s.date).getTime();
        if (solveTime < thresholdTime || solveTime > now) return;
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return;

        const effective = getEffectiveTime(s);
        if (effective === Infinity) return;

        const curr = timeByUser.get(s.userId) || { totalTime: 0, count: 0 };
        curr.totalTime += effective;
        curr.count += 1;
        timeByUser.set(s.userId, curr);
    });

    const entries: LeaderboardEntry[] = [];

    timeByUser.forEach(({ totalTime, count }, userId) => {
        if (totalTime <= 0) return;
        const user = userMap.get(userId) || {
            uid: userId,
            email: '',
            username: 'CubingUser',
            color: '#3b82f6',
            emailVerified: true
        };

        entries.push({
            rank: 0,
            user,
            scoreValue: totalTime,
            scoreDisplay: formatLeaderboardDuration(totalTime),
            secondaryDisplay: `${count} solve${count === 1 ? '' : 's'}`,
            isCurrentUser: userId === currentUserId
        });
    });

    // Sort descending by total solve time, then count
    entries.sort((a, b) => {
        if (b.scoreValue !== a.scoreValue) {
            return b.scoreValue - a.scoreValue;
        }
        return (parseInt(b.secondaryDisplay || '0', 10) || 0) - (parseInt(a.secondaryDisplay || '0', 10) || 0);
    });

    return createTopFiveSlots(entries.slice(0, 5), "Spot available — start cubing to claim!");
}

// 2. Most Goals Achieved (month, year)
export function getMostGoalsLeaderboard(
    users: UserData[],
    solves: Solve[],
    timeframe: 'month' | 'year',
    currentUserId?: string
): LeaderboardSlot[] {
    const now = Date.now();
    const timeframeMs = timeframe === 'month' ? THIRTY_DAYS_MS : ONE_YEAR_MS;
    const thresholdTime = now - timeframeMs;

    const userSolvesMap = new Map<string, Solve[]>();
    solves.forEach(s => {
        if (!s.userId) return;
        const list = userSolvesMap.get(s.userId) || [];
        list.push(s);
        userSolvesMap.set(s.userId, list);
    });

    const entries: LeaderboardEntry[] = [];

    users.forEach(user => {
        const userSolves = userSolvesMap.get(user.uid) || [];
        if (userSolves.length === 0) return;

        const solvesBefore = userSolves.filter(s => new Date(s.date).getTime() < thresholdTime);

        // Evaluate goals before vs now
        const goalsNow = evaluateUserGoals(userSolves, user);
        const goalsBefore = evaluateUserGoals(solvesBefore, user);

        const completedBeforeIds = new Set(goalsBefore.filter(g => g.completed).map(g => g.goalId));
        const newlyCompleted = goalsNow.filter(g => g.completed && !completedBeforeIds.has(g.goalId));

        const count = newlyCompleted.length;
        if (count > 0) {
            entries.push({
                rank: 0,
                user,
                scoreValue: count,
                scoreDisplay: `${count} goal${count === 1 ? '' : 's'}`,
                secondaryDisplay: `${goalsNow.filter(g => g.completed).length} total`,
                isCurrentUser: user.uid === currentUserId
            });
        }
    });

    entries.sort((a, b) => {
        if (b.scoreValue !== a.scoreValue) return b.scoreValue - a.scoreValue;
        return (userSolvesMap.get(b.user.uid)?.length || 0) - (userSolvesMap.get(a.user.uid)?.length || 0);
    });

    return createTopFiveSlots(entries.slice(0, 5), "Spot available — complete goals to claim!");
}

// 3. Most Diverse Cuber (day, week, month)
export function getMostDiverseLeaderboard(
    users: UserData[],
    solves: Solve[],
    timeframe: 'day' | 'week' | 'month',
    currentUserId?: string
): LeaderboardSlot[] {
    const now = Date.now();
    const timeframeMs = timeframe === 'day' ? ONE_DAY_MS : timeframe === 'week' ? SEVEN_DAYS_MS : THIRTY_DAYS_MS;
    const thresholdTime = now - timeframeMs;

    const userMap = new Map<string, UserData>();
    users.forEach(u => userMap.set(u.uid, u));

    const eventsByUser = new Map<string, { events: Set<string>; solveCount: number }>();

    solves.forEach(s => {
        if (!s.userId) return;
        const solveTime = new Date(s.date).getTime();
        if (solveTime < thresholdTime || solveTime > now) return;
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return;

        const eventType = s.scrambleType || '333';
        const curr = eventsByUser.get(s.userId) || { events: new Set<string>(), solveCount: 0 };
        curr.events.add(eventType);
        curr.solveCount += 1;
        eventsByUser.set(s.userId, curr);
    });

    const entries: LeaderboardEntry[] = [];

    eventsByUser.forEach(({ events, solveCount }, userId) => {
        const uniqueCount = events.size;
        if (uniqueCount <= 0) return;

        const user = userMap.get(userId) || {
            uid: userId,
            email: '',
            username: 'CubingUser',
            color: '#3b82f6',
            emailVerified: true
        };

        entries.push({
            rank: 0,
            user,
            scoreValue: uniqueCount,
            scoreDisplay: `${uniqueCount} event${uniqueCount === 1 ? '' : 's'}`,
            secondaryDisplay: `${solveCount} solve${solveCount === 1 ? '' : 's'}`,
            isCurrentUser: userId === currentUserId
        });
    });

    entries.sort((a, b) => {
        if (b.scoreValue !== a.scoreValue) return b.scoreValue - a.scoreValue;
        return (eventsByUser.get(b.user.uid)?.solveCount || 0) - (eventsByUser.get(a.user.uid)?.solveCount || 0);
    });

    return createTopFiveSlots(entries.slice(0, 5), "Spot available — try different puzzles to claim!");
}

// 4. Most Lucky (past month: most PB singles new this month; tie breaker is total solves)
export function getMostLuckyLeaderboard(
    users: UserData[],
    solves: Solve[],
    currentUserId?: string
): LeaderboardSlot[] {
    const now = Date.now();
    const thresholdTime = now - THIRTY_DAYS_MS;

    const userSolvesMap = new Map<string, Solve[]>();
    solves.forEach(s => {
        if (!s.userId) return;
        const list = userSolvesMap.get(s.userId) || [];
        list.push(s);
        userSolvesMap.set(s.userId, list);
    });

    const entries: LeaderboardEntry[] = [];

    users.forEach(user => {
        const userSolves = userSolvesMap.get(user.uid) || [];
        if (userSolves.length === 0) return;

        // Group solves by event
        const solvesByEvent: Record<string, Solve[]> = {};
        userSolves.forEach(s => {
            const type = s.scrambleType || '333';
            if (!solvesByEvent[type]) solvesByEvent[type] = [];
            solvesByEvent[type].push(s);
        });

        let newPbSinglesCount = 0;

        Object.entries(solvesByEvent).forEach(([, eventSolves]) => {
            const bestSingle = calculateBestSingleRecord(eventSolves);
            if (!bestSingle || !bestSingle.completedDate) return;

            const singleTime = new Date(bestSingle.completedDate).getTime();
            if (singleTime >= thresholdTime && singleTime <= now) {
                newPbSinglesCount += 1;
            }
        });

        if (newPbSinglesCount > 0) {
            entries.push({
                rank: 0,
                user,
                scoreValue: newPbSinglesCount,
                scoreDisplay: `${newPbSinglesCount} PB single${newPbSinglesCount === 1 ? '' : 's'}`,
                secondaryDisplay: `${userSolves.length} solves total`,
                isCurrentUser: user.uid === currentUserId
            });
        }
    });

    // Sort descending by new PB count, then total solves on account
    entries.sort((a, b) => {
        if (b.scoreValue !== a.scoreValue) return b.scoreValue - a.scoreValue;
        return (userSolvesMap.get(b.user.uid)?.length || 0) - (userSolvesMap.get(a.user.uid)?.length || 0);
    });

    return createTopFiveSlots(entries.slice(0, 5), "Spot available — set a new PB single to claim!");
}

// 5. Most Improved (this week: most amount of records broken past week)
export function getMostImprovedLeaderboard(
    users: UserData[],
    solves: Solve[],
    currentUserId?: string
): LeaderboardSlot[] {
    const userSolvesMap = new Map<string, Solve[]>();
    solves.forEach(s => {
        if (!s.userId) return;
        const list = userSolvesMap.get(s.userId) || [];
        list.push(s);
        userSolvesMap.set(s.userId, list);
    });

    const entries: LeaderboardEntry[] = [];

    users.forEach(user => {
        const userSolves = userSolvesMap.get(user.uid) || [];
        if (userSolves.length === 0) return;

        // Group by event
        const grouped: Record<string, Solve[]> = {};
        userSolves.forEach(s => {
            const type = s.scrambleType || '333';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(s);
        });

        let brokenRecordsCount = 0;

        SCRAMBLE_TYPES.forEach(opt => {
            const eventSolves = grouped[opt.value] || [];
            if (eventSolves.length === 0 && !SUPPORTED_EVENT_IDS.includes(opt.value)) return;
            if (eventSolves.length === 0) return;

            const chronological = [...eventSolves].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            const single = calculateBestSingleRecord(eventSolves);
            const ao5 = calculateBestAverageRecord(chronological, 5, 'ao5', 'Ao5', false);
            const ao12 = calculateBestAverageRecord(chronological, 12, 'ao12', 'Ao12', false);
            const ao50 = calculateBestAverageRecord(chronological, 50, 'ao50', 'Ao50', false);
            const ao100 = calculateBestAverageRecord(chronological, 100, 'ao100', 'Ao100', false);
            const ao250 = calculateBestAverageRecord(chronological, 250, 'ao250', 'Ao250', true);
            const ao1000 = calculateBestAverageRecord(chronological, 1000, 'ao1000', 'Ao1000', true);

            const records = [single, ao5, ao12, ao50, ao100, ao250, ao1000];
            records.forEach(rec => {
                if (!rec || !rec.completedDate) return;
                const tier = getRecencyTier(rec.completedDate);
                if (tier === 'today' || tier === 'last_week') {
                    brokenRecordsCount += 1;
                }
            });
        });

        if (brokenRecordsCount > 0) {
            entries.push({
                rank: 0,
                user,
                scoreValue: brokenRecordsCount,
                scoreDisplay: `${brokenRecordsCount} record${brokenRecordsCount === 1 ? '' : 's'}`,
                secondaryDisplay: `${userSolves.length} solves total`,
                isCurrentUser: user.uid === currentUserId
            });
        }
    });

    entries.sort((a, b) => {
        if (b.scoreValue !== a.scoreValue) return b.scoreValue - a.scoreValue;
        return (userSolvesMap.get(b.user.uid)?.length || 0) - (userSolvesMap.get(a.user.uid)?.length || 0);
    });

    return createTopFiveSlots(entries.slice(0, 5), "Spot available — break a personal record this week!");
}

function createTopFiveSlots(rankedEntries: LeaderboardEntry[], defaultEmptyText: string): LeaderboardSlot[] {
    const slots: LeaderboardSlot[] = [];

    for (let i = 1; i <= 5; i++) {
        const entry = rankedEntries[i - 1];
        if (entry) {
            slots.push({
                rank: i,
                entry: { ...entry, rank: i },
                isEmpty: false,
                emptyText: ''
            });
        } else {
            slots.push({
                rank: i,
                entry: null,
                isEmpty: true,
                emptyText: `#${i} ${defaultEmptyText}`
            });
        }
    }

    return slots;
}
