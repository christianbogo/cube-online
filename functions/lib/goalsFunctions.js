"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoalStreaks = exports.getDailyVolumeStats = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// @ts-ignore
const date_fns_1 = require("date-fns");
const db = admin.firestore();
function formatStreakDate(dateStr) {
    if (!dateStr)
        return null;
    try {
        const d = new Date(dateStr + 'T12:00:00');
        return (0, date_fns_1.format)(d, 'MMM d, yyyy');
    }
    catch (_a) {
        return dateStr;
    }
}
function calculateMaxStreak(dateCounts, minSolvesPerDay) {
    const qualifyingDates = Array.from(dateCounts.entries())
        .filter(([, count]) => count >= minSolvesPerDay)
        .map(([dateStr]) => ({
        dateStr,
        time: new Date(dateStr + 'T00:00:00Z').getTime()
    }))
        .sort((a, b) => a.time - b.time);
    if (qualifyingDates.length === 0) {
        return { maxStreak: 0, startDate: null, endDate: null };
    }
    const oneDayMs = 24 * 60 * 60 * 1000;
    let maxStreak = 1;
    let bestStartStr = qualifyingDates[0].dateStr;
    let bestEndStr = qualifyingDates[0].dateStr;
    let currentStreak = 1;
    let currentStartStr = qualifyingDates[0].dateStr;
    let currentEndStr = qualifyingDates[0].dateStr;
    for (let i = 1; i < qualifyingDates.length; i++) {
        const prev = qualifyingDates[i - 1];
        const curr = qualifyingDates[i];
        const diffDays = Math.round((curr.time - prev.time) / oneDayMs);
        if (diffDays === 1) {
            currentStreak++;
            currentEndStr = curr.dateStr;
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
                bestStartStr = currentStartStr;
                bestEndStr = currentEndStr;
            }
        }
        else if (diffDays > 1) {
            currentStreak = 1;
            currentStartStr = curr.dateStr;
            currentEndStr = curr.dateStr;
        }
    }
    return {
        maxStreak,
        startDate: formatStreakDate(bestStartStr),
        endDate: formatStreakDate(bestEndStr)
    };
}
/**
 * Cloud Function: getDailyVolumeStats
 * Returns date-to-count mappings (numbers and dates only) for the Goals activity heatmap.
 */
exports.getDailyVolumeStats = functions.runWith({ timeoutSeconds: 60, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const statsRef = db.collection('users').doc(userId).collection('stats').doc('overview');
    const statsDoc = await statsRef.get();
    if (statsDoc.exists) {
        const d = statsDoc.data();
        return {
            dailySolvesCount: d.dailySolvesCount || {},
            dailySolvesByEvent: d.dailySolvesByEvent || {}
        };
    }
    // Fallback: Compute from solves projection if stats doc doesn't exist
    const solvesSnap = await db.collection('solves')
        .where('userId', '==', userId)
        .select('date', 'scrambleType', 'penalty', 'inspectionPenalty')
        .get();
    const dailySolvesCount = {};
    const dailySolvesByEvent = {};
    solvesSnap.docs.forEach(doc => {
        const s = doc.data();
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF')
            return;
        if (!s.date)
            return;
        const d = new Date(s.date);
        if (isNaN(d.getTime()))
            return;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dailySolvesCount[dateStr] = (dailySolvesCount[dateStr] || 0) + 1;
        const event = s.scrambleType || '333';
        if (!dailySolvesByEvent[dateStr])
            dailySolvesByEvent[dateStr] = {};
        dailySolvesByEvent[dateStr][event] = (dailySolvesByEvent[dateStr][event] || 0) + 1;
    });
    return { dailySolvesCount, dailySolvesByEvent };
});
/**
 * Cloud Function: getGoalStreaks
 * Evaluates the 15 streak milestones on the server, returning only the calculated values and dates.
 */
exports.getGoalStreaks = functions.runWith({ timeoutSeconds: 60, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const statsRef = db.collection('users').doc(userId).collection('stats').doc('overview');
    const statsDoc = await statsRef.get();
    let dailySolvesCount = {};
    let maxSolvesInSingleDay = 0;
    let maxDayDate = null;
    if (statsDoc.exists) {
        const d = statsDoc.data();
        dailySolvesCount = d.dailySolvesCount || {};
        maxSolvesInSingleDay = d.maxSolvesInSingleDay || 0;
        Object.entries(dailySolvesCount).forEach(([dStr, count]) => {
            if (count === maxSolvesInSingleDay)
                maxDayDate = dStr;
        });
    }
    else {
        const snap = await db.collection('solves')
            .where('userId', '==', userId)
            .select('date', 'penalty', 'inspectionPenalty')
            .get();
        snap.docs.forEach(doc => {
            const s = doc.data();
            if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF')
                return;
            if (!s.date)
                return;
            const d = new Date(s.date);
            if (isNaN(d.getTime()))
                return;
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            dailySolvesCount[dateStr] = (dailySolvesCount[dateStr] || 0) + 1;
            if (dailySolvesCount[dateStr] > maxSolvesInSingleDay) {
                maxSolvesInSingleDay = dailySolvesCount[dateStr];
                maxDayDate = dateStr;
            }
        });
    }
    const dailySolvesCountMap = new Map();
    Object.entries(dailySolvesCount).forEach(([dateStr, count]) => {
        dailySolvesCountMap.set(dateStr, count);
    });
    const STREAK_CONFIGS = [
        { id: 'streak-habit-former', minSolves: 1, target: 7, unit: 'days' },
        { id: 'streak-two-week-spark', minSolves: 5, target: 14, unit: 'days' },
        { id: 'streak-monthly-ritual', minSolves: 5, target: 30, unit: 'days' },
        { id: 'streak-quarterly-routine', minSolves: 5, target: 90, unit: 'days' },
        { id: 'streak-dedicated-daily', minSolves: 10, target: 60, unit: 'days' },
        { id: 'streak-half-year-habit', minSolves: 5, target: 180, unit: 'days' },
        { id: 'streak-year-in-twists', minSolves: 1, target: 365, unit: 'days' },
        { id: 'streak-unbroken-year', minSolves: 10, target: 365, unit: 'days' },
        { id: 'streak-weekend-blitz', minSolves: 50, target: 3, unit: 'days' },
        { id: 'streak-grind-week', minSolves: 50, target: 7, unit: 'days' },
        { id: 'streak-century-run', minSolves: 100, target: 7, unit: 'days' },
        { id: 'streak-fortnight-forge', minSolves: 100, target: 14, unit: 'days' },
        { id: 'streak-iron-fingers', minSolves: 100, target: 30, unit: 'days' },
        { id: 'streak-extreme-focus', minSolves: 200, target: 7, unit: 'days' }
    ];
    const streaks = {};
    STREAK_CONFIGS.forEach(cfg => {
        const res = calculateMaxStreak(dailySolvesCountMap, cfg.minSolves);
        const completed = res.maxStreak >= cfg.target;
        const rawPercent = (res.maxStreak / cfg.target) * 100;
        const percentCompleted = completed ? 100 : Math.min(99.9, Math.max(0, Math.round(rawPercent * 10) / 10));
        streaks[cfg.id] = {
            goalId: cfg.id,
            currentValue: res.maxStreak,
            targetValue: cfg.target,
            completed,
            percentCompleted,
            displayCurrent: `${res.maxStreak} days`,
            displayTarget: `${cfg.target} days`,
            streakStartDate: res.startDate,
            streakEndDate: res.endDate
        };
    });
    // Single-day marathon goals
    const singleDayGoals = [
        { id: 'streak-hardcore-session', target: 250 },
        { id: 'streak-marathon-maniac', target: 500 }
    ];
    singleDayGoals.forEach(cfg => {
        const completed = maxSolvesInSingleDay >= cfg.target;
        const rawPercent = (maxSolvesInSingleDay / cfg.target) * 100;
        const percentCompleted = completed ? 100 : Math.min(99.9, Math.max(0, Math.round(rawPercent * 10) / 10));
        let sDate = null;
        if (maxSolvesInSingleDay > 0 && maxDayDate) {
            sDate = formatStreakDate(maxDayDate);
        }
        streaks[cfg.id] = {
            goalId: cfg.id,
            currentValue: maxSolvesInSingleDay,
            targetValue: cfg.target,
            completed,
            percentCompleted,
            displayCurrent: `${maxSolvesInSingleDay.toLocaleString()} solves`,
            displayTarget: `${cfg.target.toLocaleString()} solves`,
            streakStartDate: sDate,
            streakEndDate: sDate
        };
    });
    return { streaks };
});
//# sourceMappingURL=goalsFunctions.js.map