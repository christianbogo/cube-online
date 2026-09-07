import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
    getMostSolvingLeaderboard,
    getMostGoalsLeaderboard,
    getMostDiverseLeaderboard,
    getMostLuckyLeaderboard,
    getMostImprovedLeaderboard
} from './utils/socialCalculations';
import { calculateBestAverage } from './utils/calculations';
import {
    calculateBestSingleRecord,
    calculateBestAverageRecord,
    getEffectiveTime,
    EventRecordRow
} from './utils/recordCalculations';
import type { UserData, Solve } from './types';

admin.initializeApp({
    databaseURL: 'https://cube-online-1-default-rtdb.firebaseio.com'
});
const db = admin.firestore();

function calculateAverage(solves: any[], size: number): number | null {
    if (solves.length < size) return null;
    const slice = solves.slice(0, size);
    const drops = size === 100 ? 5 : size <= 3 ? 0 : 1;
    let dnfCount = 0;
    const times = slice.map((s: any) => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') {
            dnfCount++;
            return Infinity;
        }
        let t = s.time;
        if (s.penalty === '+2') t += 2000;
        if (s.inspectionPenalty === '+2') t += 2000;
        return t;
    });
    if (dnfCount > drops) return null;
    times.sort((a: number, b: number) => a - b);
    let sum = 0;
    for (let i = drops; i < times.length - drops; i++) sum += times[i];
    return Math.round(sum / (size - 2 * drops));
}

export const aggregateUserStats = functions.firestore
    .document('solves/{solveId}')
    .onWrite(async (change: any, context: any) => {
        const after = change.after.exists ? change.after.data() : null;
        const before = change.before.exists ? change.before.data() : null;

        if (after && before) {
            if (after.time === before.time && after.penalty === before.penalty && after.inspectionPenalty === before.inspectionPenalty && after.date === before.date && after.scrambleType === before.scrambleType) {
                return null;
            }
        }

        const userId = after ? after.userId : before?.userId;
        if (!userId) return null;

        const statsRef = db.collection('users').doc(userId).collection('stats').doc('overview');

        const event = (after?.scrambleType) || (before?.scrambleType) || '333';
        let recentSolves: any[] = [];
        if (after) {
            const recentSolvesSnap = await db.collection('solves')
                .where('userId', '==', userId)
                .where('scrambleType', '==', event)
                .orderBy('date', 'desc')
                .limit(100)
                .get();
            recentSolves = recentSolvesSnap.docs.map((d: any) => d.data());
        }

        // Invalidate records cache
        if (userId && event) {
            db.collection('users').doc(userId).collection('records').doc(event).delete().catch(console.error);
        }

        await db.runTransaction(async (transaction: any) => {
            const statsDoc = await transaction.get(statsRef);
            let stats = statsDoc.exists ? statsDoc.data()! : {
                totalSolveTimeMs: 0,
                totalSolvesCount: 0,
                maxSolvesInSingleDay: 0,
                dailySolvesCount: {} as Record<string, number>,
                validSolvesPerEvent: {} as Record<string, number>,
                hasAo5PerEvent: {} as Record<string, boolean>,
                hasAo12PerEvent: {} as Record<string, boolean>,
                hasAo100PerEvent: {} as Record<string, boolean>,
                anyAo100Completed: false,
                bestAverages: {} as Record<string, any>
            };

            if (before && before.penalty !== 'DNF' && before.inspectionPenalty !== 'DNF') {
                stats.totalSolvesCount = Math.max(0, (stats.totalSolvesCount || 0) - 1);
                let t = before.time;
                if (before.penalty === '+2') t += 2000;
                if (before.inspectionPenalty === '+2') t += 2000;
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
                if (after.penalty === '+2') t += 2000;
                if (after.inspectionPenalty === '+2') t += 2000;
                stats.totalSolveTimeMs = (stats.totalSolveTimeMs || 0) + t;
                if (!stats.validSolvesPerEvent) stats.validSolvesPerEvent = {};
                stats.validSolvesPerEvent[event] = (stats.validSolvesPerEvent[event] || 0) + 1;
                    if (after.date) {
                        const dateObj = new Date(after.date);
                        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                        if (!stats.dailySolvesCount) stats.dailySolvesCount = {};
                        if (!stats.dailySolvesByEvent) stats.dailySolvesByEvent = {};
                        if (!stats.dailySolvesByEvent[dateStr]) stats.dailySolvesByEvent[dateStr] = {};
                        
                        stats.dailySolvesCount[dateStr] = (stats.dailySolvesCount[dateStr] || 0) + 1;
                        stats.dailySolvesByEvent[dateStr][event] = (stats.dailySolvesByEvent[dateStr][event] || 0) + 1;
                        
                        if (stats.dailySolvesCount[dateStr] > (stats.maxSolvesInSingleDay || 0)) {
                            stats.maxSolvesInSingleDay = stats.dailySolvesCount[dateStr];
                        }
                    }
            }

            if (after && event) {

                if (!stats.bestAverages) stats.bestAverages = {};
                if (!stats.bestAverages[event]) stats.bestAverages[event] = { single: null, ao5: null, ao12: null, ao100: null };
                
                if (after.penalty !== 'DNF' && after.inspectionPenalty !== 'DNF') {
                    let singleTime = after.time;
                    if (after.penalty === '+2') singleTime += 2000;
                    if (after.inspectionPenalty === '+2') singleTime += 2000;
                    if (stats.bestAverages[event].single === null || singleTime < stats.bestAverages[event].single) {
                        stats.bestAverages[event].single = singleTime;
                    }
                }

                const curAo5 = calculateAverage(recentSolves, 5);
                const curAo12 = calculateAverage(recentSolves, 12);
                const curAo100 = calculateAverage(recentSolves, 100);

                if (!stats.hasAo5PerEvent) stats.hasAo5PerEvent = {};
                if (!stats.hasAo12PerEvent) stats.hasAo12PerEvent = {};
                if (!stats.hasAo100PerEvent) stats.hasAo100PerEvent = {};

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

            stats.updatedAt = FieldValue.serverTimestamp();
            transaction.set(statsRef, stats, { merge: true });
        });
        return null;
    });

export const backfillUserStats = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const statsRef = db.collection('users').doc(userId).collection('stats').doc('overview');
    const solvesSnap = await db.collection('solves').where('userId', '==', userId).get();
    const solves = solvesSnap.docs.map((d: any) => d.data());
    
    let stats = {
        totalSolveTimeMs: 0,
        totalSolvesCount: 0,
        maxSolvesInSingleDay: 0,
        dailySolvesCount: {} as Record<string, number>,
        validSolvesPerEvent: {} as Record<string, number>,
        hasAo5PerEvent: {} as Record<string, boolean>,
        hasAo12PerEvent: {} as Record<string, boolean>,
        hasAo100PerEvent: {} as Record<string, boolean>,
        anyAo100Completed: false,
        bestAverages: {} as Record<string, any>
    };

    const solvesByEvent: Record<string, any[]> = {};
    
    solves.forEach((s: any) => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return;
        stats.totalSolvesCount++;
        let t = s.time;
        if (s.penalty === '+2') t += 2000;
        if (s.inspectionPenalty === '+2') t += 2000;
        stats.totalSolveTimeMs += t;
        
        const event = s.scrambleType || '333';
        stats.validSolvesPerEvent[event] = (stats.validSolvesPerEvent[event] || 0) + 1;
        
        if (!solvesByEvent[event]) solvesByEvent[event] = [];
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
            if (s.penalty === '+2') t += 2000;
            if (s.inspectionPenalty === '+2') t += 2000;
            if (stats.bestAverages[event].single === null || t < stats.bestAverages[event].single) {
                stats.bestAverages[event].single = t;
            }
        });

        const bestAo5 = calculateBestAverage(eventSolves, 5);
        if (bestAo5 !== null && bestAo5 !== 'DNF') {
            stats.hasAo5PerEvent[event] = true;
            stats.bestAverages[event].ao5 = bestAo5;
        }
        const bestAo12 = calculateBestAverage(eventSolves, 12);
        if (bestAo12 !== null && bestAo12 !== 'DNF') {
            stats.hasAo12PerEvent[event] = true;
            stats.bestAverages[event].ao12 = bestAo12;
        }
        const bestAo100 = calculateBestAverage(eventSolves, 100);
        if (bestAo100 !== null && bestAo100 !== 'DNF') {
            stats.hasAo100PerEvent[event] = true;
            stats.anyAo100Completed = true;
            stats.bestAverages[event].ao100 = bestAo100;
        }
    }

    await statsRef.set(stats, { merge: true });
    return { success: true, count: stats.totalSolvesCount };
});

export const updateLeaderboards = functions.pubsub.schedule('every 15 minutes').onRun(async (context) => {
    const usersSnap = await db.collection('users').get();
    const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserData));

    const solvesSnap = await db.collection('solves').orderBy('date', 'desc').limit(5000).get();
    const solves = solvesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Solve));

    const solvingDaySlots = getMostSolvingLeaderboard(users, solves, 'day');
    const solvingWeekSlots = getMostSolvingLeaderboard(users, solves, 'week');
    const goalsMonthSlots = getMostGoalsLeaderboard(users, solves, 'month');
    const diverseMonthSlots = getMostDiverseLeaderboard(users, solves, 'month');
    const luckySlots = getMostLuckyLeaderboard(users, solves);
    const improvedSlots = getMostImprovedLeaderboard(users, solves);

    await db.collection('global_stats').doc('leaderboards').set({
        solvingDaySlots,
        solvingWeekSlots,
        goalsMonthSlots,
        diverseMonthSlots,
        luckySlots,
        improvedSlots,
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('Leaderboards updated successfully.');
    return null;
});

const TEN_MINUTES_MS = 10 * 60 * 1000;

export const cleanupStalePresence = functions.pubsub.schedule('every 10 minutes').onRun(async (context) => {
    const rtdb = admin.database();
    const presenceRef = rtdb.ref('presence');
    const snapshot = await presenceRef.once('value');
    const data = snapshot.val();
    if (!data) return null;

    const now = Date.now();
    const updates: Record<string, null> = {};

    for (const [uid, userPresence] of Object.entries(data as Record<string, any>)) {
        const timestamp = userPresence?.timestamp;
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

export const purgeStalePresenceManual = functions.https.onRequest(async (req, res) => {
    const rtdb = admin.database();
    const presenceRef = rtdb.ref('presence');
    const snapshot = await presenceRef.once('value');
    const data = snapshot.val();
    if (!data) {
        res.json({ success: true, removedCount: 0 });
        return;
    }

    const now = Date.now();
    const updates: Record<string, null> = {};

    for (const [uid, userPresence] of Object.entries(data as Record<string, any>)) {
        const timestamp = userPresence?.timestamp;
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

export const backfillAllUsersStats = functions.https.onRequest(async (req, res) => {
    // SECURITY: In a real app, protect this with auth. For now, it's a manual trigger.
    const usersSnap = await db.collection('users').get();
    let updatedCount = 0;

    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const statsRef = db.collection('users').doc(userId).collection('stats').doc('overview');
        const solvesSnap = await db.collection('solves').where('userId', '==', userId).get();
        const solves = solvesSnap.docs.map((d: any) => d.data());
        
        let stats = {
            totalSolveTimeMs: 0,
            totalSolvesCount: 0,
            maxSolvesInSingleDay: 0,
            dailySolvesCount: {} as Record<string, number>,
            validSolvesPerEvent: {} as Record<string, number>,
            hasAo5PerEvent: {} as Record<string, boolean>,
            hasAo12PerEvent: {} as Record<string, boolean>,
            hasAo100PerEvent: {} as Record<string, boolean>,
            anyAo100Completed: false,
            bestAverages: {} as Record<string, any>
        };

        const solvesByEvent: Record<string, any[]> = {};
        
        solves.forEach((s: any) => {
            if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return;
            stats.totalSolvesCount++;
            let t = s.time;
            if (s.penalty === '+2') t += 2000;
            if (s.inspectionPenalty === '+2') t += 2000;
            stats.totalSolveTimeMs += t;
            
            const event = s.scrambleType || '333';
            stats.validSolvesPerEvent[event] = (stats.validSolvesPerEvent[event] || 0) + 1;
            
            if (!solvesByEvent[event]) solvesByEvent[event] = [];
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
                if (s.penalty === '+2') t += 2000;
                if (s.inspectionPenalty === '+2') t += 2000;
                if (stats.bestAverages[event].single === null || t < stats.bestAverages[event].single) {
                    stats.bestAverages[event].single = t;
                }
            });

            const bestAo5 = calculateBestAverage(eventSolves, 5);
            if (bestAo5 !== null && bestAo5 !== 'DNF') {
                stats.hasAo5PerEvent[event] = true;
                stats.bestAverages[event].ao5 = bestAo5;
            }
            const bestAo12 = calculateBestAverage(eventSolves, 12);
            if (bestAo12 !== null && bestAo12 !== 'DNF') {
                stats.hasAo12PerEvent[event] = true;
                stats.bestAverages[event].ao12 = bestAo12;
            }
            const bestAo100 = calculateBestAverage(eventSolves, 100);
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

export const getRecordsData = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data: any, context: any) => {
    const userId = data?.userId || context.auth?.uid;
    if (!userId || typeof userId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }
    const result = [];

    for (const eventId of SUPPORTED_EVENT_IDS) {
        const recordDoc = await db.collection('users').doc(userId).collection('records').doc(eventId).get();
        if (recordDoc.exists) {
            result.push(recordDoc.data());
        } else {
            const solvesSnap = await db.collection('solves')
                .where('userId', '==', userId)
                .where('scrambleType', '==', eventId)
                .get();
            
            let solves = solvesSnap.docs.map(d => d.data() as Solve);
            solves.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const validTimes = solves.map((s: Solve) => getEffectiveTime(s)).filter((t: number) => t !== Infinity);
            let mean: number | null = null;
            let std: number | null = null;
            if (validTimes.length > 0) {
                mean = Math.round(validTimes.reduce((a: number, b: number) => a + b, 0) / validTimes.length);
                if (validTimes.length > 1) {
                    const variance = validTimes.reduce((acc: number, t: number) => acc + Math.pow(t - mean!, 2), 0) / validTimes.length;
                    std = Math.sqrt(variance);
                }
            }
            
            const eventLabels: Record<string, string> = {
                '333': '3x3x3', '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
                '666': '6x6x6', '777': '7x7x7', '333oh': '3x3x3 OH', 'clock': 'Clock',
                'minx': 'Megaminx', 'pyram': 'Pyraminx', 'skewb': 'Skewb', 'sq1': 'Square-1'
            };
            
            const row: EventRecordRow = {
                type: eventId,
                label: eventLabels[eventId] || eventId,
                count: solves.length,
                totalTime: validTimes.reduce((a: number, b: number) => a + b, 0),
                mean,
                std,
                single: calculateBestSingleRecord(solves),
                ao5: calculateBestAverageRecord(solves, 5, 'ao5', 'Ao5', true),
                ao12: calculateBestAverageRecord(solves, 12, 'ao12', 'Ao12', true),
                ao50: calculateBestAverageRecord(solves, 50, 'ao50', 'Ao50', true),
                ao100: calculateBestAverageRecord(solves, 100, 'ao100', 'Ao100', true),
                ao250: calculateBestAverageRecord(solves, 250, 'ao250', 'Ao250', true),
                ao1000: calculateBestAverageRecord(solves, 1000, 'ao1000', 'Ao1000', true)
            };
            
            await db.collection('users').doc(userId).collection('records').doc(eventId).set(row);
            result.push(row);
        }
    }

    return result.filter((r: any) => (r.count ?? 0) > 0 || r.single !== null);
});
export { getEventSolves } from './getEventSolves';
export { getPaginatedSolves, getLogsSidebarData, getLogsBottomStats } from './solvesLogs';
export { getDailyVolumeStats, getGoalStreaks } from './goalsFunctions';
