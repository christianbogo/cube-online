import type { Solve } from '../types';
import { isSameDay } from 'date-fns';

export interface RecordDetail {
    type: 'single' | 'ao5' | 'ao12' | 'ao50' | 'ao100' | 'ao250' | 'ao1000';
    label: string;
    size: number;
    value: number | 'DNF' | null;
    firstSolveDate: string | null;
    completedDate: string | null;
    solves: Solve[]; // Solves in chronological order
    droppedIndices: Set<number>; // Indices in `solves` that are non-counting (trimmed)
    bestSolveTime: number | null;
    worstSolveTime: number | null;
    rawMean: number | null;
    std: number | null;
    isCrossSession: boolean;
    sessionId?: string;
}

export interface EventRecordRow {
    type: string;
    label: string;
    count: number;
    totalTime: number;
    mean: number | null;
    std: number | null;
    single: RecordDetail | null;
    ao5: RecordDetail | null;
    ao12: RecordDetail | null;
    ao50: RecordDetail | null;
    ao100: RecordDetail | null;
    ao250: RecordDetail | null;
    ao1000: RecordDetail | null;
}

export const getEffectiveTime = (s: Solve): number => {
    if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return Infinity;
    let t = s.time;
    if (s.penalty === '+2') t += 2000;
    if (s.inspectionPenalty === '+2') t += 2000;
    return t;
};

export const getDropsCount = (size: number): number => {
    if (size <= 3) return 0;
    return Math.ceil(size * 0.05);
};

export const calculateWindowAverageDetails = (
    windowSolves: Solve[],
    size: number,
    type: RecordDetail['type'],
    label: string,
    isCrossSession: boolean
): RecordDetail | null => {
    if (windowSolves.length < size) return null;

    const currentSet = windowSolves.slice(0, size);
    const drops = getDropsCount(size);

    const indexedTimes = currentSet.map((s, idx) => ({
        idx,
        solve: s,
        time: getEffectiveTime(s)
    }));

    const dnfCount = indexedTimes.filter(item => item.time === Infinity).length;

    // If more DNFs than allowed drops, the average is DNF
    if (dnfCount > drops) {
        const sorted = [...indexedTimes].sort((a, b) => a.time - b.time);
        const droppedBest = sorted.slice(0, drops).map(x => x.idx);
        const droppedWorst = sorted.slice(sorted.length - drops).map(x => x.idx);
        const droppedSet = new Set([...droppedBest, ...droppedWorst]);

        return {
            type,
            label,
            size,
            value: 'DNF',
            firstSolveDate: currentSet[0].date,
            completedDate: currentSet[currentSet.length - 1].date,
            solves: currentSet,
            droppedIndices: droppedSet,
            bestSolveTime: sorted[0].time === Infinity ? null : sorted[0].time,
            worstSolveTime: null,
            rawMean: null,
            std: null,
            isCrossSession,
            sessionId: currentSet[0].sessionId
        };
    }

    const sorted = [...indexedTimes].sort((a, b) => a.time - b.time);
    const droppedBest = sorted.slice(0, drops).map(x => x.idx);
    const droppedWorst = sorted.slice(sorted.length - drops).map(x => x.idx);
    const droppedSet = new Set([...droppedBest, ...droppedWorst]);

    const counting = sorted.slice(drops, sorted.length - drops);
    const sum = counting.reduce((acc, curr) => acc + curr.time, 0);
    const avg = Math.round(sum / counting.length);

    // Valid non-DNF times for raw mean and std
    const validTimes = indexedTimes.map(i => i.time).filter(t => t !== Infinity);
    const rawMean = validTimes.length > 0
        ? Math.round(validTimes.reduce((acc, t) => acc + t, 0) / validTimes.length)
        : null;

    let std: number | null = null;
    if (validTimes.length > 1 && rawMean !== null) {
        const variance = validTimes.reduce((acc, t) => acc + Math.pow(t - rawMean, 2), 0) / validTimes.length;
        std = Math.sqrt(variance);
    }

    const validSortedTimes = sorted.map(x => x.time).filter(t => t !== Infinity);
    const bestSolveTime = validSortedTimes.length > 0 ? validSortedTimes[0] : null;
    const worstSolveTime = validSortedTimes.length > 0 ? validSortedTimes[validSortedTimes.length - 1] : null;

    return {
        type,
        label,
        size,
        value: avg,
        firstSolveDate: currentSet[0].date,
        completedDate: currentSet[currentSet.length - 1].date,
        solves: currentSet,
        droppedIndices: droppedSet,
        bestSolveTime,
        worstSolveTime,
        rawMean,
        std,
        isCrossSession,
        sessionId: currentSet[0].sessionId
    };
};

export const calculateBestSingleRecord = (solves: Solve[]): RecordDetail | null => {
    let bestSolve: Solve | null = null;
    let bestTime = Infinity;

    for (const s of solves) {
        const eff = getEffectiveTime(s);
        if (eff !== Infinity && eff < bestTime) {
            bestTime = eff;
            bestSolve = s;
        }
    }

    if (!bestSolve) return null;
    const targetSolve: Solve = bestSolve;

    return {
        type: 'single',
        label: 'Single',
        size: 1,
        value: bestTime,
        firstSolveDate: targetSolve.date,
        completedDate: targetSolve.date,
        solves: [targetSolve],
        droppedIndices: new Set(),
        bestSolveTime: bestTime,
        worstSolveTime: bestTime,
        rawMean: bestTime,
        std: 0,
        isCrossSession: false,
        sessionId: targetSolve.sessionId
    };
};

export const calculateBestAverageRecord = (
    solvesChronological: Solve[],
    size: number,
    type: RecordDetail['type'],
    label: string,
    allowCrossSession: boolean
): RecordDetail | null => {
    if (solvesChronological.length < size) return null;

    let bestDetail: RecordDetail | null = null;

    for (let i = 0; i <= solvesChronological.length - size; i++) {
        const window = solvesChronological.slice(i, i + size);

        if (!allowCrossSession) {
            const firstSession = window[0].sessionId;
            if (!firstSession || !window.every(s => s.sessionId === firstSession)) {
                continue;
            }
        }

        const detail = calculateWindowAverageDetails(window, size, type, label, allowCrossSession);
        if (!detail || detail.value === 'DNF' || detail.value === null) continue;

        if (bestDetail === null || (typeof bestDetail.value === 'number' && detail.value < bestDetail.value)) {
            bestDetail = detail;
        }
    }

    return bestDetail;
};

export type RecencyTier = 'today' | 'last_week' | 'last_month' | 'older' | 'none';

export const getRecencyTier = (completedDateStr: string | null): RecencyTier => {
    if (!completedDateStr) return 'none';
    const recordDate = new Date(completedDateStr);
    const now = new Date();

    if (isNaN(recordDate.getTime())) return 'none';

    if (isSameDay(recordDate, now)) {
        return 'today';
    }

    const diffMs = now.getTime() - recordDate.getTime();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    if (diffMs <= SEVEN_DAYS_MS && diffMs >= 0) {
        return 'last_week';
    }

    if (diffMs <= THIRTY_DAYS_MS && diffMs >= 0) {
        return 'last_month';
    }

    return 'older';
};

export const getRecencyClasses = (tier: RecencyTier): string => {
    switch (tier) {
        case 'today':
            return 'text-amber-400 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.65)] [text-shadow:0_0_10px_rgba(251,191,36,0.5)]';
        case 'last_week':
            return 'text-emerald-600 dark:text-emerald-400 font-bold';
        case 'last_month':
            return 'text-emerald-400 dark:text-emerald-300 font-semibold';
        case 'older':
        default:
            return 'text-text-primary font-medium';
    }
};
