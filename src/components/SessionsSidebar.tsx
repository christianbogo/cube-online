import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSolves } from '../contexts/SolvesContext';
import { useSettings } from '../contexts/SettingsContext';
import { calculateBestAverage, calculateBestSingle, formatTime } from '../utils/calculations';
import { ChevronDown, Calendar, Clock, Layers, Archive, CalendarDays, CalendarRange } from 'lucide-react';
import { startOfYear, startOfMonth, startOfWeek, startOfDay, format } from 'date-fns';

type GroupingType = 'all' | 'years' | 'months' | 'weeks' | 'days' | 'sessions';
type StatColumn = 'count' | 'single' | 'ao5' | 'ao12' | 'ao100' | 'time';

const GROUPING_OPTIONS: { value: GroupingType; label: string; icon: any }[] = [
    { value: 'all', label: 'All-Time', icon: Archive },
    { value: 'years', label: 'Years', icon: CalendarRange },
    { value: 'months', label: 'Months', icon: CalendarDays },
    { value: 'weeks', label: 'Weeks', icon: Calendar },
    { value: 'days', label: 'Days', icon: Clock },
    { value: 'sessions', label: 'Sessions', icon: Layers },
];

const COLUMN_OPTIONS: { value: StatColumn; label: string }[] = [
    { value: 'count', label: 'Solves' },
    { value: 'single', label: 'Best' },
    { value: 'ao5', label: 'Ao5' },
    { value: 'ao12', label: 'Ao12' },
    { value: 'ao100', label: 'Ao100' },
    { value: 'time', label: 'Time' },
];

const SCRAMBLE_TYPES = [
    { label: '3x3', value: '333' },
    { label: '2x2', value: '222' },
    { label: '4x4', value: '444' },
    { label: '5x5', value: '555' },
    { label: '6x6', value: '666' },
    { label: '7x7', value: '777' },
    { label: 'Clock', value: 'clock' },
    { label: 'Mega', value: 'minx' },
    { label: 'Pyra', value: 'pyram' },
    { label: 'Skewb', value: 'skewb' },
    { label: 'Sq-1', value: 'sq1' },
];

export default function SessionsSidebar({ onToggleCollapse: _onToggleCollapse, collapsed: _collapsed }: { onToggleCollapse: () => void, collapsed: boolean }) {
    const { user } = useAuth();
    const { solves } = useSolves(); // Assuming this contains all relevant solves
    const { settings, updateSettings } = useSettings();

    const [grouping, setGrouping] = useState<GroupingType>(() => {
        return (localStorage.getItem('sidebar_grouping') as GroupingType) || 'sessions';
    });
    const [statColumn, setStatColumn] = useState<StatColumn>(() => {
        return (localStorage.getItem('sidebar_stat_column') as StatColumn) || 'count';
    });
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    useEffect(() => {
        localStorage.setItem('sidebar_grouping', grouping);
    }, [grouping]);

    useEffect(() => {
        localStorage.setItem('sidebar_stat_column', statColumn);
    }, [statColumn]);

    // 1. Filter Solves by Event (and User)
    const filteredSolves = useMemo(() => {
        if (!user) return [];
        return solves
            .filter(s => s.userId === user.uid && (s.scrambleType || '333') === settings.scrambleType)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [solves, user, settings.scrambleType]);

    // 2. Group Solves
    const groupedItems = useMemo(() => {
        if (filteredSolves.length === 0) return [];

        if (grouping === 'all') {
            return [{
                key: 'all',
                label: 'All Time',
                solves: filteredSolves,
                date: new Date()
            }];
        }

        const groups = new Map<string, { key: string, label: string, solves: any[], date: Date }>();

        filteredSolves.forEach(solve => {
            const date = new Date(solve.date);
            let key = '';
            let label = '';
            let orderDate = date;

            switch (grouping) {
                case 'years':
                    key = format(startOfYear(date), 'yyyy');
                    label = key;
                    orderDate = startOfYear(date);
                    break;
                case 'months':
                    key = format(startOfMonth(date), 'yyyy-MM');
                    label = format(date, 'MMM yyyy');
                    orderDate = startOfMonth(date);
                    break;
                case 'weeks':
                    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
                    key = format(weekStart, 'yyyy-Iw');
                    label = `Week of ${format(weekStart, 'MMM d')}`;
                    orderDate = weekStart;
                    break;
                case 'days':
                    key = format(startOfDay(date), 'yyyy-MM-dd');
                    label = format(date, 'MMM d, yyyy');
                    orderDate = startOfDay(date);
                    break;
                case 'sessions':
                    key = solve.sessionId || 'unknown';
                    label = 'Session'; // Will be refined
                    orderDate = date; // Approximate by last solve
                    break;
            }

            if (!groups.has(key)) {
                groups.set(key, { key, label, solves: [], date: orderDate });
            }
            groups.get(key)!.solves.push(solve);
        });

        // Refine Labels for Sessions (Use Date/Time of first solve in group)
        if (grouping === 'sessions') {
            return Array.from(groups.values()).map(g => {
                const lastSolve = g.solves[0]; // Newest
                // Basic label: Date + Time
                const dateStr = format(new Date(lastSolve.date), 'MMM d, HH:mm');
                return { ...g, label: dateStr, date: new Date(lastSolve.date) };
            }).sort((a, b) => b.date.getTime() - a.date.getTime());
        }

        return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());

    }, [filteredSolves, grouping]);

    // 3. Enrich Items with Stats (Memoized per item to avoid recalc? Or just in render map)
    // Doing it inside render for simplicity or a second pass.
    // Let's do a map for clean render.
    const displayItems = useMemo(() => {
        return groupedItems.map(item => {
            const count = item.solves.length;
            const bestSingle = calculateBestSingle(item.solves);
            const bestAo5 = calculateBestAverage(item.solves, 5);
            const bestAo12 = calculateBestAverage(item.solves, 12);
            const bestAo100 = calculateBestAverage(item.solves, 100);
            const totalTime = item.solves.reduce((acc: number, s: any) => acc + (typeof s.time === 'number' ? s.time : 0), 0);

            return {
                ...item,
                stats: { count, bestSingle, bestAo5, bestAo12, bestAo100, totalTime }
            };
        });
    }, [groupedItems]);

    const formatDuration = (ms: number) => {
        const secs = Math.floor(ms / 1000);
        const mins = Math.floor(secs / 60);
        const hrs = Math.floor(mins / 60);
        if (hrs > 0) return `${hrs}h ${mins % 60}m`;
        if (mins > 0) return `${mins}m`;
        return `${secs}s`;
    };

    return (
        <aside className="h-full bg-bg-secondary w-full select-none flex flex-col text-sm overflow-hidden min-w-0 font-sans">
            {/* Header Area */}
            <div className="flex flex-col border-b border-border/50 bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10 text-text-primary">

                {/* Event Selector */}
                <div className="p-2 border-b border-border/50 flex justify-center relative group">
                    <select
                        value={settings.scrambleType}
                        onChange={(e) => updateSettings({ scrambleType: e.target.value })}
                        className="appearance-none bg-transparent font-bold hover:text-accent focus:outline-none cursor-pointer text-center text-sm w-full z-10"
                    >
                        {SCRAMBLE_TYPES.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>

                {/* Grouping Selector */}
                <div className="p-2 border-b border-border/50 flex justify-center relative group">
                    <select
                        value={grouping}
                        onChange={(e) => setGrouping(e.target.value as GroupingType)}
                        className="appearance-none bg-transparent font-bold hover:text-accent focus:outline-none cursor-pointer text-center text-sm w-full z-10"
                    >
                        {GROUPING_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>
            </div>

            {/* List Header */}
            <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2 text-xs font-bold text-text-secondary border-b border-border/20 uppercase tracking-wider items-center">
                <div className="cursor-pointer hover:text-text-primary">
                    {grouping === 'all' ? 'Period' : grouping === 'sessions' ? 'Date' : grouping.slice(0, -1)}
                </div>

                {/* Dropdown for Stat Column */}
                <div className="relative group min-w-[60px] text-right">
                    <select
                        value={statColumn}
                        onChange={(e) => setStatColumn(e.target.value as StatColumn)}
                        className="appearance-none bg-transparent hover:text-accent cursor-pointer focus:outline-none text-right w-full pr-3"
                    >
                        {COLUMN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {displayItems.length === 0 ? (
                    <div className="p-8 text-center text-text-secondary italic text-xs">No data found.</div>
                ) : (
                    displayItems.map(item => {
                        const isSelected = selectedKeys.has(item.key);
                        return (
                            <div
                                key={item.key}
                                onClick={() => {
                                    const newSet = new Set(selectedKeys);
                                    if (newSet.has(item.key)) newSet.delete(item.key);
                                    else newSet.add(item.key);
                                    setSelectedKeys(newSet);
                                }}
                                className={`grid grid-cols-[1fr_auto] gap-2 px-4 py-3 border-b border-border/10 hover:bg-bg-hover transition-colors cursor-pointer items-center
                                    ${isSelected ? 'bg-accent/10 border-l-2 border-l-accent pl-[14px]' : 'border-l-2 border-l-transparent'}
                                `}
                            >
                                {/* Label */}
                                <div className="min-w-0">
                                    <span className={`font-medium truncate ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                                        {item.label}
                                    </span>
                                </div>

                                {/* Stat */}
                                <div className="flex items-center justify-end font-mono text-sm text-text-primary min-w-[60px]">
                                    {statColumn === 'count' && <span>{item.stats.count}</span>}
                                    {statColumn === 'single' && <span>{formatTime(item.stats.bestSingle)}</span>}
                                    {statColumn === 'ao5' && <span>{formatTime(item.stats.bestAo5)}</span>}
                                    {statColumn === 'ao12' && <span>{formatTime(item.stats.bestAo12)}</span>}
                                    {statColumn === 'ao100' && <span>{formatTime(item.stats.bestAo100)}</span>}
                                    {statColumn === 'time' && <span className="text-xs text-text-secondary">{formatDuration(item.stats.totalTime)}</span>}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="p-2 border-t border-border/50 flex justify-end">
            </div>
        </aside>
    );
}
