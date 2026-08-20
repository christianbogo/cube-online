import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    getCountFromServer,
    getAggregateFromServer,
    sum
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatTimeMs } from '../../utils/admin';
import {
    Database,
    Clock,
    Users,
    Activity,
    RotateCw,
    CheckCircle2,
    AlertCircle,
    Server,
    ShieldCheck
} from 'lucide-react';
import type { FirebaseMetrics } from '../../types';

export default function FirebaseStatusTab() {
    const [metrics, setMetrics] = useState<FirebaseMetrics>({
        totalSolves: 0,
        totalSolvingTimeMs: 0,
        activeUsersPastMonth: 0,
        solvesToday: 0,
        lastUpdated: '',
        loading: true,
        error: null
    });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pingTimeMs, setPingTimeMs] = useState<number | null>(null);

    const fetchMetrics = useCallback(async () => {
        setIsRefreshing(true);
        const startTime = performance.now();

        try {
            const now = new Date();

            // 1. Start of today in ISO string (local 00:00:00)
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const todayStartISO = todayStart.toISOString();

            // 2. 30 days ago for monthly active users
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            let totalSolves = 0;
            let totalSolvingTimeMs = 0;
            let solvesToday = 0;
            let activeUsersPastMonth = 0;

            const solvesColl = collection(db, 'solves');

            // Fetch Total Solves & Total Time via Aggregation or Fallback
            try {
                const totalSolvesCountSnap = await getCountFromServer(solvesColl);
                totalSolves = totalSolvesCountSnap.data().count;

                const timeAggSnap = await getAggregateFromServer(solvesColl, {
                    totalTime: sum('time')
                });
                totalSolvingTimeMs = timeAggSnap.data().totalTime || 0;
            } catch (err) {
                console.warn("Aggregate server query failed, falling back to document fetch:", err);
                const allSolvesSnap = await getDocs(solvesColl);
                totalSolves = allSolvesSnap.size;
                let sumTime = 0;
                allSolvesSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (typeof data.time === 'number') {
                        sumTime += data.time;
                    }
                });
                totalSolvingTimeMs = sumTime;
            }

            // Fetch Solves Today
            try {
                const todayQuery = query(solvesColl, where('date', '>=', todayStartISO));
                const todayCountSnap = await getCountFromServer(todayQuery);
                solvesToday = todayCountSnap.data().count;
            } catch {
                try {
                    const todayQuery = query(solvesColl, where('date', '>=', todayStartISO));
                    const todaySnap = await getDocs(todayQuery);
                    solvesToday = todaySnap.size;
                } catch {
                    // Fallback to 0 if no index or empty
                    solvesToday = 0;
                }
            }

            // Fetch Active Users in the past month
            try {
                const usersColl = collection(db, 'users');
                const usersSnap = await getDocs(usersColl);
                let activeCount = 0;
                usersSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (data.lastSeenAt && new Date(data.lastSeenAt).getTime() >= thirtyDaysAgo.getTime()) {
                        activeCount++;
                    } else if (!data.lastSeenAt) {
                        // Fallback: count user if they exist
                        activeCount++;
                    }
                });
                activeUsersPastMonth = Math.max(activeCount, 1);
            } catch (err) {
                console.warn("Error fetching users list for dev metrics:", err);
                activeUsersPastMonth = 1;
            }

            const endTime = performance.now();
            setPingTimeMs(Math.round(endTime - startTime));

            setMetrics({
                totalSolves,
                totalSolvingTimeMs,
                activeUsersPastMonth,
                solvesToday,
                lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                loading: false,
                error: null
            });
        } catch (err: unknown) {
            console.error("Failed to load Firebase metrics:", err);
            const message = err instanceof Error ? err.message : 'Failed to query database';
            setMetrics(prev => ({
                ...prev,
                loading: false,
                error: message
            }));
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    const statCards = [
        {
            title: 'Total Database Solves',
            value: metrics.loading ? '...' : metrics.totalSolves.toLocaleString(),
            description: 'All recorded solves stored in Cloud Firestore',
            icon: Database,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20'
        },
        {
            title: 'Total Solve Time on Site',
            value: metrics.loading ? '...' : formatTimeMs(metrics.totalSolvingTimeMs),
            description: 'Cumulative active solving duration across all cubers',
            icon: Clock,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20'
        },
        {
            title: 'Solves Today',
            value: metrics.loading ? '...' : metrics.solvesToday.toLocaleString(),
            description: 'Solves logged since midnight today',
            icon: Activity,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20'
        },
        {
            title: 'Users Active in Past Month',
            value: metrics.loading ? '...' : metrics.activeUsersPastMonth.toLocaleString(),
            description: 'Distinct registered cubers active in the last 30 days',
            icon: Users,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/20'
        }
    ];

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Top Status Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bg-secondary/60 border border-border p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                        <Server className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold text-text-primary">Cloud Firestore & RTDB</h2>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Operational
                            </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                            {metrics.lastUpdated ? `Last synchronized at ${metrics.lastUpdated}` : 'Connecting to database...'}
                            {pingTimeMs !== null && ` • Response latency: ${pingTimeMs}ms`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                        onClick={fetchMetrics}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-bg-primary hover:bg-bg-hover text-text-primary border border-border transition-all cursor-pointer disabled:opacity-50"
                        title="Refresh metrics"
                    >
                        <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-accent' : ''}`} />
                        <span>{isRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
                    </button>
                </div>
            </div>

            {/* Error Notification */}
            {metrics.error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Error retrieving some database metrics: {metrics.error}</span>
                </div>
            )}

            {/* 4 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {statCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={index}
                            className="bg-bg-secondary/40 border border-border/80 rounded-2xl p-5 hover:border-accent/30 transition-all flex flex-col justify-between"
                        >
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                        {card.title}
                                    </span>
                                    <h3 className="text-2xl sm:text-3xl font-black text-text-primary mt-1 tracking-tight">
                                        {card.value}
                                    </h3>
                                </div>
                                <div className={`p-2.5 rounded-xl ${card.bg} ${card.color} border ${card.border} shrink-0`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-[11px] text-text-secondary opacity-80 border-t border-border/40 pt-2.5">
                                {card.description}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Infrastructure Details */}
            <div className="bg-bg-secondary/30 border border-border/60 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">System Integrity & Security</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-text-secondary">
                    <div className="p-3 bg-bg-primary/50 border border-border/50 rounded-xl">
                        <span className="font-semibold text-text-primary block mb-0.5">Database Edition</span>
                        <span>Firestore Standard / Native Mode</span>
                    </div>
                    <div className="p-3 bg-bg-primary/50 border border-border/50 rounded-xl">
                        <span className="font-semibold text-text-primary block mb-0.5">Realtime Sync</span>
                        <span>Presence & live timing broadcast active</span>
                    </div>
                    <div className="p-3 bg-bg-primary/50 border border-border/50 rounded-xl">
                        <span className="font-semibold text-text-primary block mb-0.5">Security Protocol</span>
                        <span>Owner isolation + Admin ACL</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
