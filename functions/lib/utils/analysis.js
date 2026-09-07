"use strict";
/**
 * Adaptive Outlier Detection (MAD Algorithm)
 *
 * Uses Rolling Window Median Absolute Deviation (MAD) to flag anomalous solves.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectOutliers = void 0;
// Parameters
const WINDOW_SIZE = 50;
const K_LOW = 5.0; // Sensitivity for "Too Fast"
const K_HIGH = 7.0; // Sensitivity for "Too Slow"
const MIN_MAD = 2000; // Critical Guardrail in milliseconds (2.0 seconds)
function detectOutliers(currentSolve, recentSolves, isGlobalPB = false) {
    let currentSolveTime;
    // If an entire solve object is passed and it was already approved, it can NEVER be flagged again
    if (typeof currentSolve === 'object' && currentSolve !== null) {
        if (currentSolve.anomalyApproved) {
            return { isOutlier: false };
        }
        currentSolveTime = currentSolve.time;
    }
    else {
        currentSolveTime = currentSolve;
    }
    // If not enough data, cannot determine outlier reliably
    if (recentSolves.length < 10) {
        return { isOutlier: false };
    }
    let times;
    if (typeof recentSolves[0] === 'number') {
        times = recentSolves;
    }
    else {
        // Filter and sort window solves (exclude DNFs and extreme invalid data)
        const windowSolves = recentSolves
            .filter(s => s.penalty !== 'DNF' && s.inspectionPenalty !== 'DNF')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, WINDOW_SIZE);
        if (windowSolves.length < 10) {
            return { isOutlier: false };
        }
        times = windowSolves.map(s => s.time);
    }
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
        if (currentSolveTime < median * 0.55 && median - currentSolveTime >= 3000 || currentSolveTime < 1500) {
            return {
                isOutlier: true,
                reason: 'suspected_misclick',
                madStats: { median, mad: effectiveMad, limitLow, limitHigh }
            };
        }
    }
    // 2. Check for Suspected Timer Run (Too Slow)
    if (currentSolveTime > limitHigh) {
        if (currentSolveTime > median * 2.5 && currentSolveTime - median >= 15000) {
            return {
                isOutlier: true,
                reason: 'suspected_timer_run',
                madStats: { median, mad: effectiveMad, limitLow, limitHigh }
            };
        }
    }
    return { isOutlier: false, madStats: { median, mad: effectiveMad, limitLow, limitHigh } };
}
exports.detectOutliers = detectOutliers;
function calculateMedian(values) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    else {
        return sorted[mid];
    }
}
//# sourceMappingURL=analysis.js.map