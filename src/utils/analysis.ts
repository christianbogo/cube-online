/**
 * Adaptive Outlier Detection (MAD Algorithm)
 * 
 * Uses Rolling Window Median Absolute Deviation (MAD) to flag anomalous solves.
 */

interface Solve {
    id: string;
    time: number;
    date: string | number | Date;
    anomalyApproved?: boolean;
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

export function detectOutliers(currentSolve: number | Solve, recentSolves: Solve[], isGlobalPB: boolean = false): OutlierResult {
    let currentSolveTime: number;

    // If an entire solve object is passed and it was already approved, it can NEVER be flagged again
    if (typeof currentSolve === 'object' && currentSolve !== null) {
        if (currentSolve.anomalyApproved) {
            return { isOutlier: false };
        }
        currentSolveTime = currentSolve.time;
    } else {
        currentSolveTime = currentSolve;
    }

    // If not enough data, cannot determine outlier reliably
    if (recentSolves.length < 10) {
        return { isOutlier: false };
    }

    // Filter and sort window solves (exclude DNFs and extreme invalid data)
    const windowSolves = recentSolves
        .filter(s => s.penalty !== 'DNF' && s.inspectionPenalty !== 'DNF')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, WINDOW_SIZE);

    if (windowSolves.length < 10) {
        return { isOutlier: false };
    }

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
