import type { Solve } from '../contexts/SolvesContext';

/**
 * Calculates the average of a set of times, removing the best and worst X times.
 * Returns 'DNF' if the count of DNFs is greater than the allowed drops.
 */
export const calculateAverage = (solves: Solve[], size: number): number | 'DNF' | null => {
    if (solves.length < size) return null;

    const currentSet = solves.slice(0, size);

    // Count DNFs
    const dnfs = currentSet.filter(s => s.penalty === 'DNF' || s.inspectionPenalty === 'DNF');

    // Logic for drops:
    // Ao5: Drop 1 best, 1 worst (allowing 1 DNF to be the "worst")
    // Ao12: Drop 1 best, 1 worst
    // Ao100: Drop 5 best, 5 worst

    let drops = 0;
    if (size === 5 || size === 12) drops = 1;
    if (size === 100) drops = 5;

    // If more DNFs than we can drop (which is 'drops' amount of worst times), it's a DNF average
    // Actually, in standard cubing (WCA), for Ao5/Ao12, you drop best and worst. 
    // If you have 2 DNFs in Ao5, the average is DNF. (One counts as worst, one remains).
    if (dnfs.length > drops) return 'DNF';

    // Get times in milliseconds, converting DNFs to Infinity for sorting
    const times = currentSet.map(s => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return Infinity;
        let t = s.time;
        if (s.penalty === '+2') t += 2000;
        if (s.inspectionPenalty === '+2') t += 2000;
        return t;
    });

    // Sort times
    times.sort((a, b) => a - b);

    // Remove best X and worst X
    // Worst times (Infinity) are at the end.
    const validTimes = times.slice(drops, times.length - drops);

    // Calculate mean
    const sum = validTimes.reduce((acc, t) => acc + t, 0);
    return Math.round(sum / validTimes.length);
};

export const calculateBestAverage = (solves: Solve[], size: number): number | 'DNF' | null => {
    if (solves.length < size) return null;

    // Pre-calculate effective times and session IDs to avoid redundant work in the inner loop
    const precomputed = solves.map(s => {
        let isDnf = s.penalty === 'DNF' || s.inspectionPenalty === 'DNF';
        let eff = Infinity;
        if (!isDnf) {
            eff = s.time;
            if (s.penalty === '+2') eff += 2000;
            if (s.inspectionPenalty === '+2') eff += 2000;
        }
        return { isDnf, eff, sessionId: s.sessionId };
    });

    let best: number | null = null;
    let drops = 0;
    if (size === 5 || size === 12) drops = 1;
    if (size === 100) drops = 5;

    for (let i = 0; i <= precomputed.length - size; i++) {
        let allSameSession = true;
        const firstSessionId = precomputed[i].sessionId;
        
        // Fast session check
        for (let j = 0; j < size; j++) {
            if (precomputed[i + j].sessionId !== firstSessionId) {
                allSameSession = false;
                break;
            }
        }

        if (!allSameSession) continue;

        let dnfCount = 0;
        for (let j = 0; j < size; j++) {
            if (precomputed[i + j].isDnf) dnfCount++;
        }

        if (dnfCount > drops) {
            // It's a DNF average, which won't be a 'best' average
            continue;
        }

        const times = [];
        for (let j = 0; j < size; j++) {
            times.push(precomputed[i + j].eff);
        }
        
        times.sort((a, b) => a - b);

        let sum = 0;
        const count = times.length - 2 * drops;
        for (let j = drops; j < times.length - drops; j++) {
            sum += times[j];
        }
        
        const avg = Math.round(sum / count);
        if (best === null || avg < best) {
            best = avg;
        }
    }
    return best;
};

export const calculateBestSingle = (solves: Solve[]): number | null => {
    const validSingles = solves
        .map(s => {
            if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return Infinity;
            let t = s.time;
            if (s.penalty === '+2') t += 2000;
            if (s.inspectionPenalty === '+2') t += 2000;
            return t;
        })
        .filter(t => t !== Infinity);

    return validSingles.length > 0 ? Math.min(...validSingles) : null;
};

import { formatTime as formatTimeUtil } from './formatTime';

export const formatTime = (ms: number | 'DNF' | null): string => {
    if (ms === null) return '-';
    if (ms === 'DNF') return 'DNF';
    return formatTimeUtil(ms);
};

export const standardDeviation = (solves: Solve[]): number => {
    const validTimes = solves
        .filter(s => s.penalty !== 'DNF' && s.inspectionPenalty !== 'DNF')
        .map(s => {
            let t = s.time;
            if (s.penalty === '+2') t += 2000;
            if (s.inspectionPenalty === '+2') t += 2000;
            return t;
        });

    if (validTimes.length === 0) return 0;

    const mean = validTimes.reduce((acc, t) => acc + t, 0) / validTimes.length;
    const variance = validTimes.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / validTimes.length;
    return Math.sqrt(variance);
};
