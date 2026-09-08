import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
    calculateBestAverage,
    calculateBestSingle,
    calculateAverage,
    standardDeviation
} from './utils/calculations';
import { detectOutliers } from './utils/analysis';
import type { Solve } from './types';
// @ts-ignore
import { startOfYear, startOfMonth, startOfWeek, startOfDay, format } from 'date-fns';

const db = admin.firestore();

export interface SidebarItemStats {
    count: number;
    bestSingle: number | 'DNF' | null;
    bestAo5: number | 'DNF' | null;
    bestAo12: number | 'DNF' | null;
    bestAo100: number | 'DNF' | null;
    totalTime: number;
}

export interface SidebarGroupItem {
    key: string;
    label: string;
    date: string;
    stats: SidebarItemStats;
}

export interface SidebarOverallStats {
    count: number;
    mean: number | 'DNF' | null;
    stdDev: number | null;
    bestSingle: number | 'DNF' | null;
    bestAo5: number | 'DNF' | null;
    bestAo12: number | 'DNF' | null;
    bestAo100: number | 'DNF' | null;
    bestAo1000: number | 'DNF' | null;
    bestAo10000: number | 'DNF' | null;
    totalTime: number;
}

/**
 * Cloud Function: getPaginatedSolves
 * Retrieves ONLY the page of solves needed for the current table view,
 * plus the total match count and detected anomalies for the page.
 */
export const getPaginatedSolves = functions.runWith({ timeoutSeconds: 60, memory: '1GB' }).https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const scrambleType = data?.scrambleType || '333';
    const grouping = data?.grouping || 'sessions';
    const selectedKeys: string[] = Array.isArray(data?.selectedKeys) ? data.selectedKeys.filter(Boolean) : [];
    const page = Math.max(1, parseInt(data?.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(data?.pageSize, 10) || 25));
    const sortKey = data?.sortKey === 'time' ? 'time' : 'date';
    const sortDirection: 'asc' | 'desc' = data?.sortDirection === 'asc' ? 'asc' : 'desc';

    // 1. Fast Path: No grouping filters and sorting by date
    if (selectedKeys.length === 0 && sortKey === 'date') {
        const baseQuery = db.collection('solves')
            .where('userId', '==', userId)
            .where('scrambleType', '==', scrambleType);

        let totalCount: number;
        if (typeof data?.knownTotalCount === 'number' && data.knownTotalCount >= 0) {
            totalCount = data.knownTotalCount;
        } else {
            const countSnap = await baseQuery.count().get();
            totalCount = countSnap.data().count;
        }

        const pageSnap = await baseQuery
            .orderBy('date', sortDirection)
            .offset((page - 1) * pageSize)
            .limit(pageSize)
            .get();

        const solves = pageSnap.docs.map(d => ({ id: d.id, ...d.data() } as Solve));

        // Anomalies for the page
        const anomalies: any[] = [];
        if (solves.length >= 10) {
            const validTimes = solves.filter(s => s.penalty !== 'DNF' && s.inspectionPenalty !== 'DNF').map(s => s.time);
            solves.forEach(s => {
                if (!s.anomalyApproved) {
                    const res = detectOutliers(s.time, validTimes);
                    if (res.isOutlier) {
                        anomalies.push({ ...s, anomalyReason: res.reason });
                    }
                }
            });
        }

        return { solves, totalCount, anomalies };
    }

    // 2. Filtered or custom-sorted path
    let query: admin.firestore.Query = db.collection('solves')
        .where('userId', '==', userId)
        .where('scrambleType', '==', scrambleType);

    // If grouping is by sessions and few keys, use indexed 'in' query
    if (grouping === 'sessions' && selectedKeys.length > 0 && selectedKeys.length <= 30) {
        query = query.where('sessionId', 'in', selectedKeys);
    }

    const snap = await query.get();
    let allMatching = snap.docs.map(d => ({ id: d.id, ...d.data() } as Solve));

    // Client-specified date grouping filters if selectedKeys are provided
    if (selectedKeys.length > 0 && grouping !== 'all') {
        const keySet = new Set(selectedKeys);
        allMatching = allMatching.filter(s => {
            if (!s.date) return false;
            const d = new Date(s.date);
            if (isNaN(d.getTime())) return false;

            let key = '';
            switch (grouping) {
                case 'years':
                    key = format(startOfYear(d), 'yyyy');
                    break;
                case 'months':
                    key = format(startOfMonth(d), 'yyyy-MM');
                    break;
                case 'weeks':
                    const weekStart = startOfWeek(d, { weekStartsOn: 1 });
                    key = format(weekStart, 'yyyy-Iw');
                    break;
                case 'days':
                    key = format(startOfDay(d), 'yyyy-MM-dd');
                    break;
                case 'sessions':
                    key = s.sessionId || 'unknown';
                    break;
            }
            return keySet.has(key);
        });
    }

    const totalCount = allMatching.length;

    // Sorting
    allMatching.sort((a, b) => {
        let valA: number;
        let valB: number;

        if (sortKey === 'time') {
            const getEffTime = (s: Solve) => {
                if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return Infinity;
                let t = s.time;
                if (s.penalty === '+2') t += 2000;
                if (s.inspectionPenalty === '+2') t += 2000;
                return t;
            };
            valA = getEffTime(a);
            valB = getEffTime(b);
        } else {
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const offset = (page - 1) * pageSize;
    const solves = allMatching.slice(offset, offset + pageSize);

    // Detected anomalies in the filtered view
    const anomalies: any[] = [];
    const validSolves = allMatching.filter(s => s.penalty !== 'DNF' && s.inspectionPenalty !== 'DNF');
    if (validSolves.length >= 10) {
        const recentTimes = validSolves.slice(-50).map(s => s.time);
        allMatching.forEach(s => {
            if (!s.anomalyApproved) {
                const res = detectOutliers(s.time, recentTimes);
                if (res.isOutlier) {
                    anomalies.push({ ...s, anomalyReason: res.reason });
                }
            }
        });
    }

    return { solves, totalCount, anomalies: anomalies.slice(0, 20) };
});

/**
 * Cloud Function: getLogsSidebarData
 * Returns ONLY the list of groups and their aggregated summary stats for the left bar,
 * with NO raw solve objects returned.
 */
export const getLogsSidebarData = functions.runWith({ timeoutSeconds: 60, memory: '1GB' }).https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const scrambleType = data?.scrambleType || '333';
    const grouping = data?.grouping || 'sessions';

    const snap = await db.collection('solves')
        .where('userId', '==', userId)
        .where('scrambleType', '==', scrambleType)
        .select('sessionId', 'date', 'time', 'penalty', 'inspectionPenalty')
        .get();

    const solves = snap.docs.map(d => ({ id: d.id, ...d.data() } as Solve));
    solves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (solves.length === 0) {
        return { groups: [] };
    }

    if (grouping === 'all') {
        const count = solves.length;
        const bestSingle = calculateBestSingle(solves);
        const bestAo5 = calculateBestAverage(solves, 5);
        const bestAo12 = calculateBestAverage(solves, 12);
        const bestAo100 = calculateBestAverage(solves, 100);
        const totalTime = solves.reduce((acc, s) => acc + (s.time || 0), 0);

        return {
            groups: [{
                key: 'all',
                label: 'All Time',
                date: new Date().toISOString(),
                stats: { count, bestSingle, bestAo5, bestAo12, bestAo100, totalTime }
            }]
        };
    }

    const groupsMap = new Map<string, { key: string; label: string; date: Date; solves: Solve[] }>();

    solves.forEach(solve => {
        if (!solve.date) return;
        const d = new Date(solve.date);
        if (isNaN(d.getTime())) return;

        let key = '';
        let label = '';
        let orderDate = d;

        switch (grouping) {
            case 'years':
                key = format(startOfYear(d), 'yyyy');
                label = key;
                orderDate = startOfYear(d);
                break;
            case 'months':
                key = format(startOfMonth(d), 'yyyy-MM');
                label = format(d, 'MMM yyyy');
                orderDate = startOfMonth(d);
                break;
            case 'weeks':
                const weekStart = startOfWeek(d, { weekStartsOn: 1 });
                key = format(weekStart, 'yyyy-Iw');
                label = `Week of ${format(weekStart, 'MMM d')}`;
                orderDate = weekStart;
                break;
            case 'days':
                key = format(startOfDay(d), 'yyyy-MM-dd');
                label = format(d, 'MMM d, yyyy');
                orderDate = startOfDay(d);
                break;
            case 'sessions':
            default:
                key = solve.sessionId || 'unknown';
                label = 'Session';
                orderDate = d;
                break;
        }

        if (!groupsMap.has(key)) {
            groupsMap.set(key, { key, label, date: orderDate, solves: [] });
        }
        groupsMap.get(key)!.solves.push(solve);
    });

    const groups: SidebarGroupItem[] = Array.from(groupsMap.values()).map(g => {
        const count = g.solves.length;
        const bestSingle = calculateBestSingle(g.solves);
        const bestAo5 = calculateBestAverage(g.solves, 5);
        const bestAo12 = calculateBestAverage(g.solves, 12);
        const bestAo100 = calculateBestAverage(g.solves, 100);
        const totalTime = g.solves.reduce((acc, s) => acc + (s.time || 0), 0);

        let displayLabel = g.label;
        if (grouping === 'sessions' && g.solves.length > 0) {
            displayLabel = format(new Date(g.solves[0].date), 'MMM d, h:mm a');
        }

        return {
            key: g.key,
            label: displayLabel,
            date: g.date.toISOString(),
            stats: { count, bestSingle, bestAo5, bestAo12, bestAo100, totalTime }
        };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { groups };
});

/**
 * Cloud Function: getLogsBottomStats
 * Calculates overall or selection-specific metrics for the left bar footer
 * without returning solve objects to the client.
 */
export const getLogsBottomStats = functions.runWith({ timeoutSeconds: 60, memory: '1GB' }).https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const scrambleType = data?.scrambleType || '333';
    const grouping = data?.grouping || 'sessions';
    const selectedKeys: string[] = Array.isArray(data?.selectedKeys) ? data.selectedKeys.filter(Boolean) : [];

    const snap = await db.collection('solves')
        .where('userId', '==', userId)
        .where('scrambleType', '==', scrambleType)
        .select('sessionId', 'date', 'time', 'penalty', 'inspectionPenalty')
        .get();

    let solves = snap.docs.map(d => ({ id: d.id, ...d.data() } as Solve));
    solves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (selectedKeys.length > 0 && grouping !== 'all') {
        const keySet = new Set(selectedKeys);
        solves = solves.filter(s => {
            if (!s.date) return false;
            const d = new Date(s.date);
            if (isNaN(d.getTime())) return false;

            let key = '';
            switch (grouping) {
                case 'years':
                    key = format(startOfYear(d), 'yyyy');
                    break;
                case 'months':
                    key = format(startOfMonth(d), 'yyyy-MM');
                    break;
                case 'weeks':
                    const weekStart = startOfWeek(d, { weekStartsOn: 1 });
                    key = format(weekStart, 'yyyy-Iw');
                    break;
                case 'days':
                    key = format(startOfDay(d), 'yyyy-MM-dd');
                    break;
                case 'sessions':
                default:
                    key = s.sessionId || 'unknown';
                    break;
            }
            return keySet.has(key);
        });
    }

    if (solves.length === 0) {
        return { stats: null };
    }

    const count = solves.length;
    const mean = calculateAverage(solves, count);
    const stdDev = standardDeviation(solves);
    const bestSingle = calculateBestSingle(solves);
    const bestAo5 = calculateBestAverage(solves, 5);
    const bestAo12 = calculateBestAverage(solves, 12);
    const bestAo100 = calculateBestAverage(solves, 100);
    const bestAo1000 = count >= 1000 ? calculateBestAverage(solves, 1000) : null;
    const bestAo10000 = count >= 10000 ? calculateBestAverage(solves, 10000) : null;

    const totalTime = solves.reduce((acc, s) => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return acc;
        let t = s.time || 0;
        if (s.penalty === '+2') t += 2000;
        if (s.inspectionPenalty === '+2') t += 2000;
        return acc + t;
    }, 0);

    const stats: SidebarOverallStats = {
        count,
        mean,
        stdDev,
        bestSingle,
        bestAo5,
        bestAo12,
        bestAo100,
        bestAo1000,
        bestAo10000,
        totalTime
    };

    return { stats };
});
