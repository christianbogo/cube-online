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
exports.getLogsBottomStats = exports.getLogsSidebarData = exports.getPaginatedSolves = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const calculations_1 = require("./utils/calculations");
const analysis_1 = require("./utils/analysis");
// @ts-ignore
const date_fns_1 = require("date-fns");
const db = admin.firestore();
/**
 * Cloud Function: getPaginatedSolves
 * Retrieves ONLY the page of solves needed for the current table view,
 * plus the total match count and detected anomalies for the page.
 */
exports.getPaginatedSolves = functions.runWith({ timeoutSeconds: 60, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const scrambleType = (data === null || data === void 0 ? void 0 : data.scrambleType) || '333';
    const grouping = (data === null || data === void 0 ? void 0 : data.grouping) || 'sessions';
    const selectedKeys = Array.isArray(data === null || data === void 0 ? void 0 : data.selectedKeys) ? data.selectedKeys.filter(Boolean) : [];
    const page = Math.max(1, parseInt(data === null || data === void 0 ? void 0 : data.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(data === null || data === void 0 ? void 0 : data.pageSize, 10) || 25));
    const sortKey = (data === null || data === void 0 ? void 0 : data.sortKey) === 'time' ? 'time' : 'date';
    const sortDirection = (data === null || data === void 0 ? void 0 : data.sortDirection) === 'asc' ? 'asc' : 'desc';
    // 1. Fast Path: No grouping filters and sorting by date
    if (selectedKeys.length === 0 && sortKey === 'date') {
        const baseQuery = db.collection('solves')
            .where('userId', '==', userId)
            .where('scrambleType', '==', scrambleType);
        const countSnap = await baseQuery.count().get();
        const totalCount = countSnap.data().count;
        const pageSnap = await baseQuery
            .orderBy('date', sortDirection)
            .offset((page - 1) * pageSize)
            .limit(pageSize)
            .get();
        const solves = pageSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
        // Anomalies for the page
        const anomalies = [];
        if (solves.length >= 10) {
            const validTimes = solves.filter(s => s.penalty !== 'DNF' && s.inspectionPenalty !== 'DNF').map(s => s.time);
            solves.forEach(s => {
                if (!s.anomalyApproved) {
                    const res = (0, analysis_1.detectOutliers)(s.time, validTimes);
                    if (res.isOutlier) {
                        anomalies.push(Object.assign(Object.assign({}, s), { anomalyReason: res.reason }));
                    }
                }
            });
        }
        return { solves, totalCount, anomalies };
    }
    // 2. Filtered or custom-sorted path
    let query = db.collection('solves')
        .where('userId', '==', userId)
        .where('scrambleType', '==', scrambleType);
    // If grouping is by sessions and few keys, use indexed 'in' query
    if (grouping === 'sessions' && selectedKeys.length > 0 && selectedKeys.length <= 30) {
        query = query.where('sessionId', 'in', selectedKeys);
    }
    const snap = await query.get();
    let allMatching = snap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
    // Client-specified date grouping filters if selectedKeys are provided
    if (selectedKeys.length > 0 && grouping !== 'all') {
        const keySet = new Set(selectedKeys);
        allMatching = allMatching.filter(s => {
            if (!s.date)
                return false;
            const d = new Date(s.date);
            if (isNaN(d.getTime()))
                return false;
            let key = '';
            switch (grouping) {
                case 'years':
                    key = (0, date_fns_1.format)((0, date_fns_1.startOfYear)(d), 'yyyy');
                    break;
                case 'months':
                    key = (0, date_fns_1.format)((0, date_fns_1.startOfMonth)(d), 'yyyy-MM');
                    break;
                case 'weeks':
                    const weekStart = (0, date_fns_1.startOfWeek)(d, { weekStartsOn: 1 });
                    key = (0, date_fns_1.format)(weekStart, 'yyyy-Iw');
                    break;
                case 'days':
                    key = (0, date_fns_1.format)((0, date_fns_1.startOfDay)(d), 'yyyy-MM-dd');
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
        let valA;
        let valB;
        if (sortKey === 'time') {
            const getEffTime = (s) => {
                if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF')
                    return Infinity;
                let t = s.time;
                if (s.penalty === '+2')
                    t += 2000;
                if (s.inspectionPenalty === '+2')
                    t += 2000;
                return t;
            };
            valA = getEffTime(a);
            valB = getEffTime(b);
        }
        else {
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
        }
        if (valA < valB)
            return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB)
            return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    const offset = (page - 1) * pageSize;
    const solves = allMatching.slice(offset, offset + pageSize);
    // Detected anomalies in the filtered view
    const anomalies = [];
    const validSolves = allMatching.filter(s => s.penalty !== 'DNF' && s.inspectionPenalty !== 'DNF');
    if (validSolves.length >= 10) {
        const recentTimes = validSolves.slice(-50).map(s => s.time);
        allMatching.forEach(s => {
            if (!s.anomalyApproved) {
                const res = (0, analysis_1.detectOutliers)(s.time, recentTimes);
                if (res.isOutlier) {
                    anomalies.push(Object.assign(Object.assign({}, s), { anomalyReason: res.reason }));
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
exports.getLogsSidebarData = functions.runWith({ timeoutSeconds: 60, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const scrambleType = (data === null || data === void 0 ? void 0 : data.scrambleType) || '333';
    const grouping = (data === null || data === void 0 ? void 0 : data.grouping) || 'sessions';
    const snap = await db.collection('solves')
        .where('userId', '==', userId)
        .where('scrambleType', '==', scrambleType)
        .select('sessionId', 'date', 'time', 'penalty', 'inspectionPenalty')
        .get();
    const solves = snap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
    solves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (solves.length === 0) {
        return { groups: [] };
    }
    if (grouping === 'all') {
        const count = solves.length;
        const bestSingle = (0, calculations_1.calculateBestSingle)(solves);
        const bestAo5 = (0, calculations_1.calculateBestAverage)(solves, 5);
        const bestAo12 = (0, calculations_1.calculateBestAverage)(solves, 12);
        const bestAo100 = (0, calculations_1.calculateBestAverage)(solves, 100);
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
    const groupsMap = new Map();
    solves.forEach(solve => {
        if (!solve.date)
            return;
        const d = new Date(solve.date);
        if (isNaN(d.getTime()))
            return;
        let key = '';
        let label = '';
        let orderDate = d;
        switch (grouping) {
            case 'years':
                key = (0, date_fns_1.format)((0, date_fns_1.startOfYear)(d), 'yyyy');
                label = key;
                orderDate = (0, date_fns_1.startOfYear)(d);
                break;
            case 'months':
                key = (0, date_fns_1.format)((0, date_fns_1.startOfMonth)(d), 'yyyy-MM');
                label = (0, date_fns_1.format)(d, 'MMM yyyy');
                orderDate = (0, date_fns_1.startOfMonth)(d);
                break;
            case 'weeks':
                const weekStart = (0, date_fns_1.startOfWeek)(d, { weekStartsOn: 1 });
                key = (0, date_fns_1.format)(weekStart, 'yyyy-Iw');
                label = `Week of ${(0, date_fns_1.format)(weekStart, 'MMM d')}`;
                orderDate = weekStart;
                break;
            case 'days':
                key = (0, date_fns_1.format)((0, date_fns_1.startOfDay)(d), 'yyyy-MM-dd');
                label = (0, date_fns_1.format)(d, 'MMM d, yyyy');
                orderDate = (0, date_fns_1.startOfDay)(d);
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
        groupsMap.get(key).solves.push(solve);
    });
    const groups = Array.from(groupsMap.values()).map(g => {
        const count = g.solves.length;
        const bestSingle = (0, calculations_1.calculateBestSingle)(g.solves);
        const bestAo5 = (0, calculations_1.calculateBestAverage)(g.solves, 5);
        const bestAo12 = (0, calculations_1.calculateBestAverage)(g.solves, 12);
        const bestAo100 = (0, calculations_1.calculateBestAverage)(g.solves, 100);
        const totalTime = g.solves.reduce((acc, s) => acc + (s.time || 0), 0);
        let displayLabel = g.label;
        if (grouping === 'sessions' && g.solves.length > 0) {
            displayLabel = (0, date_fns_1.format)(new Date(g.solves[0].date), 'MMM d, h:mm a');
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
exports.getLogsBottomStats = functions.runWith({ timeoutSeconds: 60, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const scrambleType = (data === null || data === void 0 ? void 0 : data.scrambleType) || '333';
    const grouping = (data === null || data === void 0 ? void 0 : data.grouping) || 'sessions';
    const selectedKeys = Array.isArray(data === null || data === void 0 ? void 0 : data.selectedKeys) ? data.selectedKeys.filter(Boolean) : [];
    const snap = await db.collection('solves')
        .where('userId', '==', userId)
        .where('scrambleType', '==', scrambleType)
        .select('sessionId', 'date', 'time', 'penalty', 'inspectionPenalty')
        .get();
    let solves = snap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
    solves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (selectedKeys.length > 0 && grouping !== 'all') {
        const keySet = new Set(selectedKeys);
        solves = solves.filter(s => {
            if (!s.date)
                return false;
            const d = new Date(s.date);
            if (isNaN(d.getTime()))
                return false;
            let key = '';
            switch (grouping) {
                case 'years':
                    key = (0, date_fns_1.format)((0, date_fns_1.startOfYear)(d), 'yyyy');
                    break;
                case 'months':
                    key = (0, date_fns_1.format)((0, date_fns_1.startOfMonth)(d), 'yyyy-MM');
                    break;
                case 'weeks':
                    const weekStart = (0, date_fns_1.startOfWeek)(d, { weekStartsOn: 1 });
                    key = (0, date_fns_1.format)(weekStart, 'yyyy-Iw');
                    break;
                case 'days':
                    key = (0, date_fns_1.format)((0, date_fns_1.startOfDay)(d), 'yyyy-MM-dd');
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
    const mean = (0, calculations_1.calculateAverage)(solves, count);
    const stdDev = (0, calculations_1.standardDeviation)(solves);
    const bestSingle = (0, calculations_1.calculateBestSingle)(solves);
    const bestAo5 = (0, calculations_1.calculateBestAverage)(solves, 5);
    const bestAo12 = (0, calculations_1.calculateBestAverage)(solves, 12);
    const bestAo100 = (0, calculations_1.calculateBestAverage)(solves, 100);
    const bestAo1000 = count >= 1000 ? (0, calculations_1.calculateBestAverage)(solves, 1000) : null;
    const bestAo10000 = count >= 10000 ? (0, calculations_1.calculateBestAverage)(solves, 10000) : null;
    const totalTime = solves.reduce((acc, s) => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF')
            return acc;
        let t = s.time || 0;
        if (s.penalty === '+2')
            t += 2000;
        if (s.inspectionPenalty === '+2')
            t += 2000;
        return acc + t;
    }, 0);
    const stats = {
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
//# sourceMappingURL=solvesLogs.js.map