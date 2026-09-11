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
exports.adminDeleteUserAccountFn = exports.deleteImportedSolvesFn = exports.deleteAllSolvesFn = exports.deleteUserAccountFn = exports.exportUserData = exports.getGoalStreaks = exports.getDailyVolumeStats = exports.getOldestSolveNumber = exports.getLogsBottomStats = exports.getLogsSidebarData = exports.getPaginatedSolves = exports.getUserRecentSolves = exports.getRecordsData = exports.backfillAllUsersStats = exports.purgeStalePresenceManual = exports.cleanupStaleRooms = exports.cleanupStalePresence = exports.updateLeaderboards = exports.backfillUserStats = exports.aggregateUserStats = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const socialCalculations_1 = require("./utils/socialCalculations");
const calculations_1 = require("./utils/calculations");
const recordCalculations_1 = require("./utils/recordCalculations");
admin.initializeApp({
    databaseURL: 'https://cube-online-1-default-rtdb.firebaseio.com'
});
const db = admin.firestore();
function calculateAverage(solves, size) {
    if (solves.length < size)
        return null;
    const slice = solves.slice(0, size);
    const drops = size === 100 ? 5 : size <= 3 ? 0 : 1;
    let dnfCount = 0;
    const times = slice.map((s) => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') {
            dnfCount++;
            return Infinity;
        }
        let t = s.time;
        if (s.penalty === '+2')
            t += 2000;
        if (s.inspectionPenalty === '+2')
            t += 2000;
        return t;
    });
    if (dnfCount > drops)
        return null;
    times.sort((a, b) => a - b);
    let sum = 0;
    for (let i = drops; i < times.length - drops; i++)
        sum += times[i];
    return Math.round(sum / (size - 2 * drops));
}
exports.aggregateUserStats = functions.firestore
    .document('solves/{solveId}')
    .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;
    if (after && before) {
        if (after.time === before.time && after.penalty === before.penalty && after.inspectionPenalty === before.inspectionPenalty && after.date === before.date && after.scrambleType === before.scrambleType) {
            return null;
        }
    }
    const userId = after ? after.userId : before === null || before === void 0 ? void 0 : before.userId;
    if (!userId)
        return null;
    const statsRef = db.collection('users').doc(userId).collection('stats').doc('overview');
    const event = (after === null || after === void 0 ? void 0 : after.scrambleType) || (before === null || before === void 0 ? void 0 : before.scrambleType) || '333';
    let recentSolves = [];
    if (after) {
        const recentSolvesSnap = await db.collection('solves')
            .where('userId', '==', userId)
            .where('scrambleType', '==', event)
            .orderBy('date', 'desc')
            .limit(100)
            .get();
        recentSolves = recentSolvesSnap.docs.map((d) => d.data());
    }
    // Invalidate records cache
    if (userId && event) {
        db.collection('users').doc(userId).collection('records').doc(event).delete().catch(console.error);
    }
    await db.runTransaction(async (transaction) => {
        const statsDoc = await transaction.get(statsRef);
        let stats = statsDoc.exists ? statsDoc.data() : {
            totalSolveTimeMs: 0,
            totalSolvesCount: 0,
            maxSolvesInSingleDay: 0,
            dailySolvesCount: {},
            validSolvesPerEvent: {},
            hasAo5PerEvent: {},
            hasAo12PerEvent: {},
            hasAo100PerEvent: {},
            anyAo100Completed: false,
            bestAverages: {}
        };
        if (before && before.penalty !== 'DNF' && before.inspectionPenalty !== 'DNF') {
            stats.totalSolvesCount = Math.max(0, (stats.totalSolvesCount || 0) - 1);
            let t = before.time;
            if (before.penalty === '+2')
                t += 2000;
            if (before.inspectionPenalty === '+2')
                t += 2000;
            stats.totalSolveTimeMs = Math.max(0, (stats.totalSolveTimeMs || 0) - t);
            const event = before.scrambleType || '333';
            if (stats.validSolvesPerEvent && stats.validSolvesPerEvent[event]) {
                stats.validSolvesPerEvent[event] = Math.max(0, stats.validSolvesPerEvent[event] - 1);
            }
            if (before.date) {
                const dateObj = new Date(before.date);
                const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                if (stats.dailySolvesCount && stats.dailySolvesCount[dateStr]) {
                    stats.dailySolvesCount[dateStr] = Math.max(0, stats.dailySolvesCount[dateStr] - 1);
                }
                if (stats.dailySolvesByEvent && stats.dailySolvesByEvent[dateStr] && stats.dailySolvesByEvent[dateStr][event]) {
                    stats.dailySolvesByEvent[dateStr][event] = Math.max(0, stats.dailySolvesByEvent[dateStr][event] - 1);
                }
            }
        }
        if (after && after.penalty !== 'DNF' && after.inspectionPenalty !== 'DNF') {
            stats.totalSolvesCount = (stats.totalSolvesCount || 0) + 1;
            let t = after.time;
            if (after.penalty === '+2')
                t += 2000;
            if (after.inspectionPenalty === '+2')
                t += 2000;
            stats.totalSolveTimeMs = (stats.totalSolveTimeMs || 0) + t;
            if (!stats.validSolvesPerEvent)
                stats.validSolvesPerEvent = {};
            stats.validSolvesPerEvent[event] = (stats.validSolvesPerEvent[event] || 0) + 1;
            if (after.date) {
                const dateObj = new Date(after.date);
                const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                if (!stats.dailySolvesCount)
                    stats.dailySolvesCount = {};
                if (!stats.dailySolvesByEvent)
                    stats.dailySolvesByEvent = {};
                if (!stats.dailySolvesByEvent[dateStr])
                    stats.dailySolvesByEvent[dateStr] = {};
                stats.dailySolvesCount[dateStr] = (stats.dailySolvesCount[dateStr] || 0) + 1;
                stats.dailySolvesByEvent[dateStr][event] = (stats.dailySolvesByEvent[dateStr][event] || 0) + 1;
                if (stats.dailySolvesCount[dateStr] > (stats.maxSolvesInSingleDay || 0)) {
                    stats.maxSolvesInSingleDay = stats.dailySolvesCount[dateStr];
                }
            }
        }
        if (after && event) {
            if (!stats.bestAverages)
                stats.bestAverages = {};
            if (!stats.bestAverages[event])
                stats.bestAverages[event] = { single: null, ao5: null, ao12: null, ao100: null };
            if (after.penalty !== 'DNF' && after.inspectionPenalty !== 'DNF') {
                let singleTime = after.time;
                if (after.penalty === '+2')
                    singleTime += 2000;
                if (after.inspectionPenalty === '+2')
                    singleTime += 2000;
                if (stats.bestAverages[event].single === null || singleTime < stats.bestAverages[event].single) {
                    stats.bestAverages[event].single = singleTime;
                }
            }
            const curAo5 = calculateAverage(recentSolves, 5);
            const curAo12 = calculateAverage(recentSolves, 12);
            const curAo100 = calculateAverage(recentSolves, 100);
            if (!stats.hasAo5PerEvent)
                stats.hasAo5PerEvent = {};
            if (!stats.hasAo12PerEvent)
                stats.hasAo12PerEvent = {};
            if (!stats.hasAo100PerEvent)
                stats.hasAo100PerEvent = {};
            if (curAo5 !== null) {
                stats.hasAo5PerEvent[event] = true;
                if (stats.bestAverages[event].ao5 === null || curAo5 < stats.bestAverages[event].ao5) {
                    stats.bestAverages[event].ao5 = curAo5;
                }
            }
            if (curAo12 !== null) {
                stats.hasAo12PerEvent[event] = true;
                if (stats.bestAverages[event].ao12 === null || curAo12 < stats.bestAverages[event].ao12) {
                    stats.bestAverages[event].ao12 = curAo12;
                }
            }
            if (curAo100 !== null) {
                stats.hasAo100PerEvent[event] = true;
                stats.anyAo100Completed = true;
                if (stats.bestAverages[event].ao100 === null || curAo100 < stats.bestAverages[event].ao100) {
                    stats.bestAverages[event].ao100 = curAo100;
                }
            }
        }
        stats.updatedAt = firestore_1.FieldValue.serverTimestamp();
        transaction.set(statsRef, stats, { merge: true });
    });
    return null;
});
exports.backfillUserStats = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const statsRef = db.collection('users').doc(userId).collection('stats').doc('overview');
    const solvesSnap = await db.collection('solves').where('userId', '==', userId).get();
    const solves = solvesSnap.docs.map((d) => d.data());
    let stats = {
        totalSolveTimeMs: 0,
        totalSolvesCount: 0,
        maxSolvesInSingleDay: 0,
        dailySolvesCount: {},
        validSolvesPerEvent: {},
        hasAo5PerEvent: {},
        hasAo12PerEvent: {},
        hasAo100PerEvent: {},
        anyAo100Completed: false,
        bestAverages: {}
    };
    const solvesByEvent = {};
    solves.forEach((s) => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF')
            return;
        stats.totalSolvesCount++;
        let t = s.time;
        if (s.penalty === '+2')
            t += 2000;
        if (s.inspectionPenalty === '+2')
            t += 2000;
        stats.totalSolveTimeMs += t;
        const event = s.scrambleType || '333';
        stats.validSolvesPerEvent[event] = (stats.validSolvesPerEvent[event] || 0) + 1;
        if (!solvesByEvent[event])
            solvesByEvent[event] = [];
        solvesByEvent[event].push(s);
        if (s.date) {
            const dateObj = new Date(s.date);
            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            stats.dailySolvesCount[dateStr] = (stats.dailySolvesCount[dateStr] || 0) + 1;
            if (stats.dailySolvesCount[dateStr] > stats.maxSolvesInSingleDay) {
                stats.maxSolvesInSingleDay = stats.dailySolvesCount[dateStr];
            }
        }
    });
    for (const [event, eventSolves] of Object.entries(solvesByEvent)) {
        eventSolves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        stats.bestAverages[event] = { single: null, ao5: null, ao12: null, ao100: null };
        eventSolves.forEach(s => {
            let t = s.time;
            if (s.penalty === '+2')
                t += 2000;
            if (s.inspectionPenalty === '+2')
                t += 2000;
            if (stats.bestAverages[event].single === null || t < stats.bestAverages[event].single) {
                stats.bestAverages[event].single = t;
            }
        });
        const bestAo5 = (0, calculations_1.calculateBestAverage)(eventSolves, 5);
        if (bestAo5 !== null && bestAo5 !== 'DNF') {
            stats.hasAo5PerEvent[event] = true;
            stats.bestAverages[event].ao5 = bestAo5;
        }
        const bestAo12 = (0, calculations_1.calculateBestAverage)(eventSolves, 12);
        if (bestAo12 !== null && bestAo12 !== 'DNF') {
            stats.hasAo12PerEvent[event] = true;
            stats.bestAverages[event].ao12 = bestAo12;
        }
        const bestAo100 = (0, calculations_1.calculateBestAverage)(eventSolves, 100);
        if (bestAo100 !== null && bestAo100 !== 'DNF') {
            stats.hasAo100PerEvent[event] = true;
            stats.anyAo100Completed = true;
            stats.bestAverages[event].ao100 = bestAo100;
        }
    }
    await statsRef.set(stats, { merge: true });
    return { success: true, count: stats.totalSolvesCount };
});
exports.updateLeaderboards = functions.pubsub.schedule('every 15 minutes').onRun(async (context) => {
    const usersSnap = await db.collection('users').get();
    const users = usersSnap.docs.map(d => (Object.assign({ uid: d.id }, d.data())));
    const solvesSnap = await db.collection('solves').orderBy('date', 'desc').limit(5000).get();
    const solves = solvesSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
    const solvingDaySlots = (0, socialCalculations_1.getMostSolvingLeaderboard)(users, solves, 'day');
    const solvingWeekSlots = (0, socialCalculations_1.getMostSolvingLeaderboard)(users, solves, 'week');
    const goalsMonthSlots = (0, socialCalculations_1.getMostGoalsLeaderboard)(users, solves, 'month');
    const diverseMonthSlots = (0, socialCalculations_1.getMostDiverseLeaderboard)(users, solves, 'month');
    const luckySlots = (0, socialCalculations_1.getMostLuckyLeaderboard)(users, solves);
    const improvedSlots = (0, socialCalculations_1.getMostImprovedLeaderboard)(users, solves);
    await db.collection('global_stats').doc('leaderboards').set({
        solvingDaySlots,
        solvingWeekSlots,
        goalsMonthSlots,
        diverseMonthSlots,
        luckySlots,
        improvedSlots,
        updatedAt: firestore_1.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('Leaderboards updated successfully.');
    return null;
});
const TEN_MINUTES_MS = 10 * 60 * 1000;
exports.cleanupStalePresence = functions.pubsub.schedule('every 10 minutes').onRun(async (context) => {
    const rtdb = admin.database();
    const presenceRef = rtdb.ref('presence');
    const snapshot = await presenceRef.once('value');
    const data = snapshot.val();
    if (!data)
        return null;
    const now = Date.now();
    const updates = {};
    for (const [uid, userPresence] of Object.entries(data)) {
        const timestamp = userPresence === null || userPresence === void 0 ? void 0 : userPresence.timestamp;
        if (!timestamp || (now - timestamp) > TEN_MINUTES_MS) {
            updates[uid] = null;
        }
    }
    const count = Object.keys(updates).length;
    if (count > 0) {
        await presenceRef.update(updates);
        console.log(`Cleaned up ${count} stale presence records:`, Object.keys(updates));
    }
    return null;
});
exports.cleanupStaleRooms = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    var _a;
    const rtdb = admin.database();
    const roomsRef = rtdb.ref('rooms');
    const snapshot = await roomsRef.once('value');
    const data = snapshot.val();
    if (!data)
        return null;
    const now = Date.now();
    const updates = {};
    for (const [roomId, room] of Object.entries(data)) {
        const players = (room === null || room === void 0 ? void 0 : room.players) ? Object.keys(room.players) : [];
        const ageMs = now - ((room === null || room === void 0 ? void 0 : room.createdAt) || 0);
        const heartbeatAgeMs = (room === null || room === void 0 ? void 0 : room.hostHeartbeat) ? (now - room.hostHeartbeat) : null;
        // Stale if room is older than 30s with no host heartbeat, or if host heartbeat hasn't updated in > 45s
        const isStale = (ageMs > 30000 && heartbeatAgeMs === null) || (heartbeatAgeMs !== null && heartbeatAgeMs > 45000);
        const isMissingHost = Boolean((room === null || room === void 0 ? void 0 : room.host) && !((_a = room === null || room === void 0 ? void 0 : room.players) === null || _a === void 0 ? void 0 : _a[room.host]));
        if (players.length === 0 || isMissingHost || isStale) {
            updates[roomId] = null;
        }
    }
    const count = Object.keys(updates).length;
    if (count > 0) {
        await roomsRef.update(updates);
        console.log(`Cleaned up ${count} stale arena rooms:`, Object.keys(updates));
    }
    return null;
});
exports.purgeStalePresenceManual = functions.https.onRequest(async (req, res) => {
    const rtdb = admin.database();
    const presenceRef = rtdb.ref('presence');
    const snapshot = await presenceRef.once('value');
    const data = snapshot.val();
    if (!data) {
        res.json({ success: true, removedCount: 0 });
        return;
    }
    const now = Date.now();
    const updates = {};
    for (const [uid, userPresence] of Object.entries(data)) {
        const timestamp = userPresence === null || userPresence === void 0 ? void 0 : userPresence.timestamp;
        if (!timestamp || (now - timestamp) > TEN_MINUTES_MS) {
            updates[uid] = null;
        }
    }
    const count = Object.keys(updates).length;
    if (count > 0) {
        await presenceRef.update(updates);
    }
    res.json({ success: true, removedCount: count, removedUids: Object.keys(updates) });
});
exports.backfillAllUsersStats = functions.https.onRequest(async (req, res) => {
    // SECURITY: In a real app, protect this with auth. For now, it's a manual trigger.
    const usersSnap = await db.collection('users').get();
    let updatedCount = 0;
    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const statsRef = db.collection('users').doc(userId).collection('stats').doc('overview');
        const solvesSnap = await db.collection('solves').where('userId', '==', userId).get();
        const solves = solvesSnap.docs.map((d) => d.data());
        let stats = {
            totalSolveTimeMs: 0,
            totalSolvesCount: 0,
            maxSolvesInSingleDay: 0,
            dailySolvesCount: {},
            validSolvesPerEvent: {},
            hasAo5PerEvent: {},
            hasAo12PerEvent: {},
            hasAo100PerEvent: {},
            anyAo100Completed: false,
            bestAverages: {}
        };
        const solvesByEvent = {};
        solves.forEach((s) => {
            if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF')
                return;
            stats.totalSolvesCount++;
            let t = s.time;
            if (s.penalty === '+2')
                t += 2000;
            if (s.inspectionPenalty === '+2')
                t += 2000;
            stats.totalSolveTimeMs += t;
            const event = s.scrambleType || '333';
            stats.validSolvesPerEvent[event] = (stats.validSolvesPerEvent[event] || 0) + 1;
            if (!solvesByEvent[event])
                solvesByEvent[event] = [];
            solvesByEvent[event].push(s);
            if (s.date) {
                const dateObj = new Date(s.date);
                const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                stats.dailySolvesCount[dateStr] = (stats.dailySolvesCount[dateStr] || 0) + 1;
                if (stats.dailySolvesCount[dateStr] > stats.maxSolvesInSingleDay) {
                    stats.maxSolvesInSingleDay = stats.dailySolvesCount[dateStr];
                }
            }
        });
        for (const [event, eventSolves] of Object.entries(solvesByEvent)) {
            eventSolves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            stats.bestAverages[event] = { single: null, ao5: null, ao12: null, ao100: null };
            eventSolves.forEach(s => {
                let t = s.time;
                if (s.penalty === '+2')
                    t += 2000;
                if (s.inspectionPenalty === '+2')
                    t += 2000;
                if (stats.bestAverages[event].single === null || t < stats.bestAverages[event].single) {
                    stats.bestAverages[event].single = t;
                }
            });
            const bestAo5 = (0, calculations_1.calculateBestAverage)(eventSolves, 5);
            if (bestAo5 !== null && bestAo5 !== 'DNF') {
                stats.hasAo5PerEvent[event] = true;
                stats.bestAverages[event].ao5 = bestAo5;
            }
            const bestAo12 = (0, calculations_1.calculateBestAverage)(eventSolves, 12);
            if (bestAo12 !== null && bestAo12 !== 'DNF') {
                stats.hasAo12PerEvent[event] = true;
                stats.bestAverages[event].ao12 = bestAo12;
            }
            const bestAo100 = (0, calculations_1.calculateBestAverage)(eventSolves, 100);
            if (bestAo100 !== null && bestAo100 !== 'DNF') {
                stats.hasAo100PerEvent[event] = true;
                stats.anyAo100Completed = true;
                stats.bestAverages[event].ao100 = bestAo100;
            }
        }
        await statsRef.set(stats, { merge: true });
        updatedCount++;
    }
    res.json({ success: true, updatedCount });
});
const SUPPORTED_EVENT_IDS = ['333', '222', '444', '555', '666', '777', '333oh', 'clock', 'minx', 'pyram', 'skewb', 'sq1'];
exports.getRecordsData = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    var _a, _b;
    const userId = (data === null || data === void 0 ? void 0 : data.userId) || ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid);
    if (!userId || typeof userId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }
    const result = [];
    for (const eventId of SUPPORTED_EVENT_IDS) {
        const recordDoc = await db.collection('users').doc(userId).collection('records').doc(eventId).get();
        if (recordDoc.exists && ((_b = recordDoc.data()) === null || _b === void 0 ? void 0 : _b.version) === 2) {
            result.push(recordDoc.data());
        }
        else {
            const solvesSnap = await db.collection('solves')
                .where('userId', '==', userId)
                .where('scrambleType', '==', eventId)
                .get();
            let solves = solvesSnap.docs.map(d => d.data());
            solves.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const validTimes = solves.map((s) => (0, recordCalculations_1.getEffectiveTime)(s)).filter((t) => t !== Infinity);
            let mean = null;
            let std = null;
            if (validTimes.length > 0) {
                mean = Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length);
                if (validTimes.length > 1) {
                    const variance = validTimes.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / validTimes.length;
                    std = Math.sqrt(variance);
                }
            }
            const eventLabels = {
                '333': '3x3x3', '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
                '666': '6x6x6', '777': '7x7x7', '333oh': '3x3x3 OH', 'clock': 'Clock',
                'minx': 'Megaminx', 'pyram': 'Pyraminx', 'skewb': 'Skewb', 'sq1': 'Square-1'
            };
            const row = {
                type: eventId,
                label: eventLabels[eventId] || eventId,
                count: solves.length,
                totalTime: validTimes.reduce((a, b) => a + b, 0),
                mean,
                std,
                single: (0, recordCalculations_1.calculateBestSingleRecord)(solves),
                ao5: (0, recordCalculations_1.calculateBestAverageRecord)(solves, 5, 'ao5', 'Ao5', false),
                ao12: (0, recordCalculations_1.calculateBestAverageRecord)(solves, 12, 'ao12', 'Ao12', false),
                ao50: (0, recordCalculations_1.calculateBestAverageRecord)(solves, 50, 'ao50', 'Ao50', false),
                ao100: (0, recordCalculations_1.calculateBestAverageRecord)(solves, 100, 'ao100', 'Ao100', false),
                ao250: (0, recordCalculations_1.calculateBestAverageRecord)(solves, 250, 'ao250', 'Ao250', true),
                ao1000: (0, recordCalculations_1.calculateBestAverageRecord)(solves, 1000, 'ao1000', 'Ao1000', true),
                version: 2
            };
            await db.collection('users').doc(userId).collection('records').doc(eventId).set(row);
            result.push(row);
        }
    }
    return result.filter((r) => { var _a; return ((_a = r.count) !== null && _a !== void 0 ? _a : 0) > 0 || r.single !== null; });
});
exports.getUserRecentSolves = functions.runWith({ timeoutSeconds: 60, memory: '512MB' }).https.onCall(async (data, context) => {
    var _a;
    const userId = (data === null || data === void 0 ? void 0 : data.userId) || ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid);
    if (!userId || typeof userId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }
    try {
        const snap = await db.collection('solves')
            .where('userId', '==', userId)
            .orderBy('date', 'desc')
            .limit(25)
            .get();
        const solves = snap.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        return { solves };
    }
    catch (err) {
        console.error('Error fetching recent solves for user:', userId, err);
        throw new functions.https.HttpsError('internal', 'Failed to fetch recent solves');
    }
});
var solvesLogs_1 = require("./solvesLogs");
Object.defineProperty(exports, "getPaginatedSolves", { enumerable: true, get: function () { return solvesLogs_1.getPaginatedSolves; } });
Object.defineProperty(exports, "getLogsSidebarData", { enumerable: true, get: function () { return solvesLogs_1.getLogsSidebarData; } });
Object.defineProperty(exports, "getLogsBottomStats", { enumerable: true, get: function () { return solvesLogs_1.getLogsBottomStats; } });
Object.defineProperty(exports, "getOldestSolveNumber", { enumerable: true, get: function () { return solvesLogs_1.getOldestSolveNumber; } });
var goalsFunctions_1 = require("./goalsFunctions");
Object.defineProperty(exports, "getDailyVolumeStats", { enumerable: true, get: function () { return goalsFunctions_1.getDailyVolumeStats; } });
Object.defineProperty(exports, "getGoalStreaks", { enumerable: true, get: function () { return goalsFunctions_1.getGoalStreaks; } });
var bulkOperations_1 = require("./bulkOperations");
Object.defineProperty(exports, "exportUserData", { enumerable: true, get: function () { return bulkOperations_1.exportUserData; } });
Object.defineProperty(exports, "deleteUserAccountFn", { enumerable: true, get: function () { return bulkOperations_1.deleteUserAccountFn; } });
Object.defineProperty(exports, "deleteAllSolvesFn", { enumerable: true, get: function () { return bulkOperations_1.deleteAllSolvesFn; } });
Object.defineProperty(exports, "deleteImportedSolvesFn", { enumerable: true, get: function () { return bulkOperations_1.deleteImportedSolvesFn; } });
Object.defineProperty(exports, "adminDeleteUserAccountFn", { enumerable: true, get: function () { return bulkOperations_1.adminDeleteUserAccountFn; } });
//# sourceMappingURL=index.js.map