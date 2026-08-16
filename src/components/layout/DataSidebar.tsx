import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSolves, type Solve } from '../../contexts/SolvesContext';
import { useSettings } from '../../contexts/SettingsContext';
import { calculateBestAverage, calculateBestSingle, formatTime, calculateAverage, standardDeviation } from '../../utils/calculations';
import { ChevronDown, Calendar, Clock, Layers, Archive, CalendarDays, CalendarRange } from 'lucide-react';
import { startOfYear, startOfMonth, startOfWeek, startOfDay, format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';

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

export default function DataSidebar({ onToggleCollapse: _onToggleCollapse, collapsed: _collapsed }: { onToggleCollapse?: () => void, collapsed?: boolean }) {
    const { user } = useAuth();
    const { solves } = useSolves();
    const { settings, updateSettings } = useSettings();
    const [searchParams, setSearchParams] = useSearchParams();

    // -- State --
    const [grouping, setGrouping] = useState<GroupingType>(() => {
        return (searchParams.get('grouping') as GroupingType) || (localStorage.getItem('sidebar_grouping') as GroupingType) || 'sessions';
    });
    const [statColumn, setStatColumn] = useState<StatColumn>(() => {
        return (localStorage.getItem('sidebar_stat_column') as StatColumn) || 'count';
    });

    // Derived Selection from URL
    const selectedKeys = useMemo(() => {
        const sel = searchParams.get('selected');
        return sel ? new Set(sel.split(',')) : new Set<string>();
    }, [searchParams]);

    // -- Effects --
    useEffect(() => {
        localStorage.setItem('sidebar_grouping', grouping);

        const newParams = new URLSearchParams(searchParams);
        if (newParams.get('grouping') !== grouping) {
            newParams.set('grouping', grouping);
            newParams.delete('selected');
            setSearchParams(newParams, { replace: true });
        }
    }, [grouping, setSearchParams, searchParams]);

    useEffect(() => {
        localStorage.setItem('sidebar_stat_column', statColumn);
    }, [statColumn]);

    // 1. Filter Solves by Event (and User)
    const filteredSolves = useMemo(() => {
        let base = solves;
        if (user) {
            base = solves.filter(s => s.userId === user.uid);
        }
        return base
            .filter(s => (s.scrambleType || '333') === settings.scrambleType)
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

        const groups = new Map<string, { key: string, label: string, solves: Solve[], date: Date }>();

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
                    label = 'Session';
                    orderDate = date;
                    break;
            }

            if (!groups.has(key)) {
                groups.set(key, { key, label, solves: [], date: orderDate });
            }
            groups.get(key)!.solves.push(solve);
        });

        if (grouping === 'sessions') {
            return Array.from(groups.values()).map(g => {
                const lastSolve = g.solves[0];
                const dateStr = format(new Date(lastSolve.date), 'MMM d, h:mm a');
                return { ...g, label: dateStr, date: new Date(lastSolve.date) };
            }).sort((a, b) => b.date.getTime() - a.date.getTime());
        }

        return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());

    }, [filteredSolves, grouping]);

    // 3. Enrich Items with Stats
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

    const handleSelect = (key: string) => {
        const newSet = new Set(selectedKeys);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);

        const newParams = new URLSearchParams(searchParams);
        if (newSet.size === 0) {
            newParams.delete('selected');
        } else {
            newParams.set('selected', Array.from(newSet).join(','));
        }
        setSearchParams(newParams);
    };

    // -- Footer Stats Calculation --
    const selectedStats = useMemo(() => {
        let targetSolves: Solve[] = [];

        if (selectedKeys.size === 0) {
            targetSolves = filteredSolves;
        } else {
            groupedItems.forEach(g => {
                if (selectedKeys.has(g.key)) {
                    targetSolves.push(...g.solves);
                }
            });
        }

        if (targetSolves.length === 0) return null;

        const count = targetSolves.length;
        const mean = calculateAverage(targetSolves, targetSolves.length);
        const stdDev = standardDeviation(targetSolves);
        const bestSingle = calculateBestSingle(targetSolves);
        const bestAo5 = calculateBestAverage(targetSolves, 5);
        const bestAo12 = calculateBestAverage(targetSolves, 12);
        const bestAo100 = calculateBestAverage(targetSolves, 100);
        const bestAo1000 = targetSolves.length >= 1000 ? calculateBestAverage(targetSolves, 1000) : null;
        const bestAo10000 = targetSolves.length >= 10000 ? calculateBestAverage(targetSolves, 10000) : null;

        const totalTime = targetSolves.reduce((acc, s) => {
            if (s.penalty === 'DNF') return acc;
            let t = s.time;
            if (s.penalty === '+2') t += 2000;
            return acc + t;
        }, 0);

        return {
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
    }, [selectedKeys, groupedItems, filteredSolves]);

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
                <div className="relative group min-w-[120px] text-right">
                    <select
                        value={statColumn}
                        onChange={(e) => setStatColumn(e.target.value as StatColumn)}
                        className="appearance-none bg-transparent hover:text-accent cursor-pointer focus:outline-none text-right w-full pr-3 uppercase"
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
                                onClick={() => handleSelect(item.key)}
                                className={`grid grid-cols-[1fr_auto] gap-2 px-4 py-3 border-b border-border/10 hover:bg-bg-hover transition-colors cursor-pointer items-center
                                    ${isSelected ? 'bg-accent/10 border-l-2 border-l-accent pl-[14px]' : 'border-l-2 border-l-transparent'}
                                `}
                            >
                                <div className="min-w-0">
                                    <span className={`font-medium truncate ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                                        {item.label}
                                    </span>
                                </div>

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

            {/* Footer Stats Table */}
            <div className="border-t border-border bg-bg-secondary p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] uppercase font-bold text-text-secondary">
                        {selectedKeys.size > 0 ? `Selected (${selectedKeys.size})` : 'All Solves'}
                    </div>
                    {selectedKeys.size > 0 && (
                        <button
                            onClick={() => {
                                const newParams = new URLSearchParams(searchParams);
                                newParams.delete('selected');
                                setSearchParams(newParams);
                            }}
                            className="text-[10px] text-accent hover:text-accent/80 font-medium transition-colors cursor-pointer"
                        >
                            Unselect All
                        </button>
                    )}
                </div>

                {selectedStats ? (
                    <div className="flex flex-col gap-1 text-xs px-1">
                        <div className="flex justify-between items-center">
                            <span className="text-text-secondary">Solves</span>
                            <span className="font-mono text-text-primary">{selectedStats.count}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-text-secondary">Time</span>
                            <span className="font-mono text-text-primary">{formatDuration(selectedStats.totalTime)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-text-secondary">Mean</span>
                            <span className="font-mono text-text-primary">{formatTime(selectedStats.mean)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-text-secondary">Std Dev</span>
                            <span className="font-mono text-text-primary">{formatTime(selectedStats.stdDev)}</span>
                        </div>

                        <div className="h-[1px] bg-border/50 my-1" />

                        <div className="flex justify-between items-center">
                            <span className="text-text-secondary">Best</span>
                            <span className="font-mono text-text-primary font-bold">{formatTime(selectedStats.bestSingle)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-text-secondary">Ao5</span>
                            <span className="font-mono text-text-primary font-bold">{formatTime(selectedStats.bestAo5)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-text-secondary">Ao12</span>
                            <span className="font-mono text-text-primary font-bold">{formatTime(selectedStats.bestAo12)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-text-secondary">Ao100</span>
                            <span className="font-mono text-text-primary font-bold">{formatTime(selectedStats.bestAo100)}</span>
                        </div>
                        {selectedStats.bestAo1000 && (
                            <div className="flex justify-between items-center">
                                <span className="text-text-secondary">Ao1000</span>
                                <span className="font-mono text-text-primary font-bold">{formatTime(selectedStats.bestAo1000)}</span>
                            </div>
                        )}
                        {selectedStats.bestAo10000 && (
                            <div className="flex justify-between items-center">
                                <span className="text-text-secondary">Ao10000</span>
                                <span className="font-mono text-text-primary font-bold">{formatTime(selectedStats.bestAo10000)}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-text-secondary/50 italic py-2">No data</div>
                )}
            </div>
        </aside>
    );
}
