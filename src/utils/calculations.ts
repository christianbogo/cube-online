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

export const formatTime = (ms: number | 'DNF' | null): string => {
    if (ms === null) return '-';
    if (ms === 'DNF') return 'DNF';
    return (ms / 1000).toFixed(2);
};
