// Removed unused BarChart3 import
import { useSolves } from '../../contexts/SolvesContext';
import { useMemo } from 'react';
import { calculateBestSingle, formatTime, calculateBestAverage } from '../../utils/calculations';
import { SCRAMBLE_TYPES, SUPPORTED_EVENT_IDS } from '../../utils/constants';

export default function ProfileStatsTab() {
    const { solves } = useSolves();

    // Group solves for statistics
    const stats = useMemo(() => {
        const totalSolves = solves.length;
        const totalTime = solves.reduce((acc, curr) => {
            if (curr.penalty === 'DNF') return acc;
            let t = curr.time;
            if (curr.penalty === '+2') t += 2000;
            return acc + t;
        }, 0);

        // Days with activity
        const uniqueDays = new Set(solves.map(s => new Date(s.date).toDateString()));
        const activeDays = uniqueDays.size;

        // Group by Event
        const grouped: Record<string, typeof solves> = {};

        solves.forEach(s => {
            const type = s.scrambleType || '333';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(s);
        });

        // Filter events with > 0 solves
        const eventsData = Object.entries(grouped)
            .filter(([type, list]) => list.length > 0 && SUPPORTED_EVENT_IDS.includes(type))
            .map(([type, list]) => {
                // Calculate per-event totals
                const eventTotalTime = list.reduce((acc, curr) => {
                    if (curr.penalty === 'DNF') return acc;
                    let t = curr.time;
                    if (curr.penalty === '+2') t += 2000;
                    return acc + t;
                }, 0);

                return {
                    type,
                    count: list.length,
                    totalTime: eventTotalTime,
                    bestSingle: calculateBestSingle(list),
                    bestAo5: calculateBestAverage(list, 5),
                    bestAo12: calculateBestAverage(list, 12),
                    bestAo100: calculateBestAverage(list, 100),
                    solves: list
                };
            });

        return {
            totalSolves,
            totalTime,
            activeDays,
            events: eventsData
        };
    }, [solves]);

    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    return (
        <div className="flex flex-col gap-8 p-2">
            {/* Global Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface-elevation-1 border border-border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-text-primary">{stats.totalSolves}</span>
                    <span className="text-xs text-text-secondary uppercase tracking-wider">Total Solves</span>
                </div>
                <div className="bg-surface-elevation-1 border border-border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-text-primary">{formatDuration(stats.totalTime)}</span>
                    <span className="text-xs text-text-secondary uppercase tracking-wider">Total Time</span>
                </div>
                <div className="bg-surface-elevation-1 border border-border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-text-primary">{stats.activeDays}</span>
                    <span className="text-xs text-text-secondary uppercase tracking-wider">Active Days</span>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-text-secondary uppercase bg-bg-tertiary border-b border-border">
                        <tr>
                            <th className="px-4 py-3 font-medium">Event</th>
                            <th className="px-4 py-3 font-medium text-right">Solves</th>
                            <th className="px-4 py-3 font-medium text-right">Time</th>
                            <th className="px-4 py-3 font-medium text-right">Single</th>
                            <th className="px-4 py-3 font-medium text-right">Ao5</th>
                            <th className="px-4 py-3 font-medium text-right">Ao12</th>
                            <th className="px-4 py-3 font-medium text-right">Ao100</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {stats.events.map(event => {
                            const opt = SCRAMBLE_TYPES.find(o => o.value === event.type);
                            const eventName = opt ? opt.label : event.type;
                            return (
                                <tr key={event.type} className="hover:bg-bg-hover/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-text-primary">
                                        {eventName}
                                    </td>
                                    <td className="px-4 py-3 text-right text-text-secondary font-mono">{event.count}</td>
                                    <td className="px-4 py-3 text-right text-text-secondary font-mono">{formatDuration(event.totalTime)}</td>
                                    <td className="px-4 py-3 text-right text-text-primary font-mono font-bold">{formatTime(event.bestSingle)}</td>
                                    <td className="px-4 py-3 text-right text-text-secondary font-mono">{formatTime(event.bestAo5)}</td>
                                    <td className="px-4 py-3 text-right text-text-secondary font-mono">{formatTime(event.bestAo12)}</td>
                                    <td className="px-4 py-3 text-right text-text-secondary font-mono">{formatTime(event.bestAo100)}</td>
                                </tr>
                            );
                        })}
                        {stats.events.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-text-secondary italic">
                                    No solves found. Start solving to see your stats!
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="text-xs text-text-secondary italic text-center">
                * Only events with &gt;0 solves are shown. Averages calculated from all-time data.
            </div>
        </div>
    );
}
