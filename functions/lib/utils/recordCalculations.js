"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecencyClasses = exports.getRecencyTier = exports.calculateBestAverageRecord = exports.calculateBestSingleRecord = exports.calculateWindowAverageDetails = exports.getDropsCount = exports.getEffectiveTime = void 0;
const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};
const getEffectiveTime = (s) => {
    if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF')
        return Infinity;
    let t = s.time;
    if (s.penalty === '+2')
        t += 2000;
    if (s.inspectionPenalty === '+2')
        t += 2000;
    return t;
};
exports.getEffectiveTime = getEffectiveTime;
const getDropsCount = (size) => {
    if (size <= 3)
        return 0;
    return Math.ceil(size * 0.05);
};
exports.getDropsCount = getDropsCount;
const calculateWindowAverageDetails = (windowSolves, size, type, label, isCrossSession) => {
    if (windowSolves.length < size)
        return null;
    const currentSet = windowSolves.slice(0, size);
    const drops = (0, exports.getDropsCount)(size);
    const indexedTimes = currentSet.map((s, idx) => ({
        idx,
        solve: s,
        time: (0, exports.getEffectiveTime)(s)
    }));
    const dnfCount = indexedTimes.filter(item => item.time === Infinity).length;
    // If more DNFs than allowed drops, the average is DNF
    if (dnfCount > drops) {
        const sorted = [...indexedTimes].sort((a, b) => a.time - b.time);
        const droppedBest = sorted.slice(0, drops).map(x => x.idx);
        const droppedWorst = sorted.slice(sorted.length - drops).map(x => x.idx);
        const droppedSet = [...droppedBest, ...droppedWorst];
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
    const droppedSet = [...droppedBest, ...droppedWorst];
    const counting = sorted.slice(drops, sorted.length - drops);
    const sum = counting.reduce((acc, curr) => acc + curr.time, 0);
    const avg = Math.round(sum / counting.length);
    // Valid non-DNF times for raw mean and std
    const validTimes = indexedTimes.map(i => i.time).filter(t => t !== Infinity);
    const rawMean = validTimes.length > 0
        ? Math.round(validTimes.reduce((acc, t) => acc + t, 0) / validTimes.length)
        : null;
    let std = null;
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
exports.calculateWindowAverageDetails = calculateWindowAverageDetails;
const calculateBestSingleRecord = (solves) => {
    let bestSolve = null;
    let bestTime = Infinity;
    for (const s of solves) {
        const eff = (0, exports.getEffectiveTime)(s);
        if (eff !== Infinity && eff < bestTime) {
            bestTime = eff;
            bestSolve = s;
        }
    }
    if (!bestSolve)
        return null;
    const targetSolve = bestSolve;
    return {
        type: 'single',
        label: 'Single',
        size: 1,
        value: bestTime,
        firstSolveDate: targetSolve.date,
        completedDate: targetSolve.date,
        solves: [targetSolve],
        droppedIndices: [],
        bestSolveTime: bestTime,
        worstSolveTime: bestTime,
        rawMean: bestTime,
        std: 0,
        isCrossSession: false,
        sessionId: targetSolve.sessionId
    };
};
exports.calculateBestSingleRecord = calculateBestSingleRecord;
const calculateBestAverageRecord = (solvesChronological, size, type, label, allowCrossSession) => {
    if (solvesChronological.length < size)
        return null;
    let bestDetail = null;
    let bestValue = null;
    const precomputed = solvesChronological.map(s => ({
        time: (0, exports.getEffectiveTime)(s),
        sessionId: s.sessionId
    }));
    const drops = (0, exports.getDropsCount)(size);
    for (let i = 0; i <= precomputed.length - size; i++) {
        if (!allowCrossSession) {
            const firstSession = precomputed[i].sessionId;
            if (!firstSession)
                continue;
            let sameSession = true;
            for (let j = 0; j < size; j++) {
                if (precomputed[i + j].sessionId !== firstSession) {
                    sameSession = false;
                    break;
                }
            }
            if (!sameSession)
                continue;
        }
        // Fast average calculation
        let dnfCount = 0;
        for (let j = 0; j < size; j++) {
            if (precomputed[i + j].time === Infinity)
                dnfCount++;
        }
        if (dnfCount > drops)
            continue;
        const times = [];
        for (let j = 0; j < size; j++) {
            times.push(precomputed[i + j].time);
        }
        times.sort((a, b) => a - b);
        let sum = 0;
        for (let j = drops; j < size - drops; j++) {
            sum += times[j];
        }
        const avg = Math.round(sum / (size - 2 * drops));
        if (bestValue === null || avg < bestValue) {
            bestValue = avg;
            const windowSolves = solvesChronological.slice(i, i + size);
            const detail = (0, exports.calculateWindowAverageDetails)(windowSolves, size, type, label, allowCrossSession);
            if (detail && typeof detail.value === 'number') {
                bestDetail = detail;
                bestValue = detail.value; // ensure they stay in sync
            }
        }
    }
    return bestDetail;
};
exports.calculateBestAverageRecord = calculateBestAverageRecord;
const getRecencyTier = (completedDateStr) => {
    if (!completedDateStr)
        return 'none';
    const recordDate = new Date(completedDateStr);
    const now = new Date();
    if (isNaN(recordDate.getTime()))
        return 'none';
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
exports.getRecencyTier = getRecencyTier;
const getRecencyClasses = (tier) => {
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
exports.getRecencyClasses = getRecencyClasses;
//# sourceMappingURL=recordCalculations.js.map