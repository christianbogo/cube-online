/**
 * Adaptive Outlier Detection (MAD Algorithm)
 * 
 * Uses Rolling Window Median Absolute Deviation (MAD) to flag anomalous solves.
 */

interface Solve {
    id: string;
    time: number;
    date: string | number | Date;
    [key: string]: any;
}

export interface OutlierResult {
    isOutlier: boolean;
    reason?: 'suspected_misclick' | 'suspected_timer_run';
    madStats?: {
        median: number;
        mad: number;
        limitLow: number;
        limitHigh: number;
    }
}

// Parameters
const WINDOW_SIZE = 50;
const K_LOW = 3.0; // Sensitivity for "Too Fast"
const K_HIGH = 5.0; // Sensitivity for "Too Slow"
const MIN_MAD = 0.5; // Critical Guardrail in seconds

export function detectOutliers(currentSolveTime: number, recentSolves: Solve[], isGlobalPB: boolean = false): OutlierResult {
    // If not enough data, cannot determine outlier reliably
    if (recentSolves.length < 10) {
        return { isOutlier: false };
    }

    // Sort solves by date desc to get recent window
    // Assuming recentSolves are already sorted or we sort them here.
    // We only need the times.
    const windowSolves = recentSolves
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, WINDOW_SIZE);

    const times = windowSolves.map(s => s.time);

    // Calculate Median
    const median = calculateMedian(times);

    // Calculate Absolute Deviations
    const deviations = times.map(t => Math.abs(t - median));

    // Calculate MAD (Median of Deviations)
    const rawMad = calculateMedian(deviations);

    // Apply Guardrail
    const effectiveMad = Math.max(rawMad, MIN_MAD);

    // Calculate Limits
    const limitLow = median - (K_LOW * effectiveMad);
    const limitHigh = median + (K_HIGH * effectiveMad);

    // Evaluation
    // 1. Check for Suspected Misclick (Too Fast)
    if (currentSolveTime < limitLow && !isGlobalPB) {
        return {
            isOutlier: true,
            reason: 'suspected_misclick',
            madStats: { median, mad: effectiveMad, limitLow, limitHigh }
        };
    }

    // 2. Check for Suspected Timer Run (Too Slow)
    if (currentSolveTime > limitHigh) {
        return {
            isOutlier: true,
            reason: 'suspected_timer_run',
            madStats: { median, mad: effectiveMad, limitLow, limitHigh }
        };
    }

    return { isOutlier: false, madStats: { median, mad: effectiveMad, limitLow, limitHigh } };
}

function calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        return sorted[mid];
    }
}
