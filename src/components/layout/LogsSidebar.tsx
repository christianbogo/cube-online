import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSolves } from '../../contexts/SolvesContext';
import { useSettings } from '../../contexts/SettingsContext';
import { formatTime } from '../../utils/calculations';
import { ChevronDown, Calendar, Clock, Layers, Archive, CalendarDays, CalendarRange, Check, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import {
    getCachedSidebarDataSync,
    getCachedSidebarData,
    setCachedSidebarData,
    isLogsCacheExpired,
    LOGS_CACHE_EXPIRED_EVENT,
    type SidebarCachedData,
    type SidebarGroupItem,
    type SidebarOverallStats
} from '../../utils/logsCache';
import { useEvents } from '../../hooks/useEvents';

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
    { value: 'count', label: 'Solve Count' },
    { value: 'single', label: 'Best Single' },
    { value: 'ao5', label: 'Best Ao5' },
    { value: 'ao12', label: 'Best Ao12' },
    { value: 'ao100', label: 'Best Ao100' },
    { value: 'time', label: 'Accumulative Time' },
];

export default function LogsSidebar({ onToggleCollapse: _onToggleCollapse, collapsed: _collapsed }: { onToggleCollapse?: () => void, collapsed?: boolean }) {
    const { user } = useAuth();
    const { allEvents } = useEvents();
    const { settings, updateSettings } = useSettings();
    const [searchParams, setSearchParams] = useSearchParams();

    // -- State --
    const [grouping, setGrouping] = useState<GroupingType>(() => {
        return (searchParams.get('grouping') as GroupingType) || (localStorage.getItem('sidebar_grouping') as GroupingType) || 'sessions';
    });
    const [statColumn, setStatColumn] = useState<StatColumn>(() => {
        return (localStorage.getItem('sidebar_stat_column') as StatColumn) || 'count';
    });

    // -- Cached Text Content (Storage-efficient local cache) --
    const [cachedData, setCachedData] = useState<SidebarCachedData | null>(() => {
        return getCachedSidebarDataSync(user?.uid, settings.scrambleType, true);
    });

    const [serverGroups, setServerGroups] = useState<SidebarGroupItem[] | null>(null);
    const [groupsLoading, setGroupsLoading] = useState<boolean>(false);

    const [serverStats, setServerStats] = useState<SidebarOverallStats | null>(null);
    const [statsLoading, setStatsLoading] = useState<boolean>(false);

    useEffect(() => {
        const sync = getCachedSidebarDataSync(user?.uid, settings.scrambleType, true);
        setCachedData(sync);
        if (!sync && user) {
            getCachedSidebarData(user.uid, settings.scrambleType, true).then(data => {
                if (data) setCachedData(data);
            });
        }
    }, [user?.uid, settings.scrambleType]);

    // Listen for cache expiration
    useEffect(() => {
        const handleExpired = (e: Event) => {
            const customEvent = e as CustomEvent<{ userId?: string }>;
            const expiredUid = customEvent.detail?.userId;
            if (!expiredUid || !user || expiredUid === user.uid) {
                setCachedData(null);
                setServerGroups(null);
                setServerStats(null);
            }
        };

        window.addEventListener(LOGS_CACHE_EXPIRED_EVENT, handleExpired);
        return () => window.removeEventListener(LOGS_CACHE_EXPIRED_EVENT, handleExpired);
    }, [user]);

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

    const { solves: recentSolves, userStats } = useSolves();
    // Only show events that have at least one solve for the user, plus the currently selected event if any
    const availableEventOptions = useMemo(() => {
        const eventsWithSolves = new Set<string>();
        
        if (userStats && userStats.validSolvesPerEvent) {
            Object.entries(userStats.validSolvesPerEvent).forEach(([e, count]) => {
                if ((count as number) > 0) {
                    eventsWithSolves.add(e);
                }
            });
        }
        
        recentSolves.filter(s => !user || s.userId === user.uid).forEach(s => {
            eventsWithSolves.add(s.scrambleType || '333');
        });

        const filtered = allEvents.filter(opt =>
            eventsWithSolves.has(opt.value) || opt.value === settings.scrambleType
        );

        return filtered.length > 0 ? filtered : allEvents;
    }, [recentSolves, userStats, user, settings.scrambleType, allEvents]);

    // Fetch sidebar groups from Cloud Function
    useEffect(() => {
        if (!user) {
            setServerGroups([]);
            setGroupsLoading(false);
            return;
        }

        let isMounted = true;
        const fetchGroups = async () => {
            const hasLocal = cachedData?.groupsByGrouping?.[grouping] && !isLogsCacheExpired(user.uid);
            if (!hasLocal) {
                setGroupsLoading(true);
            }
            try {
                const fn = httpsCallable(functions, 'getLogsSidebarData');
                const res = await fn({ scrambleType: settings.scrambleType, grouping });
                const groups = (res.data as { groups: SidebarGroupItem[] }).groups || [];
                if (isMounted) {
                    setServerGroups(groups);
                    setCachedData(prev => {
                        const updated: SidebarCachedData = {
                            groupsByGrouping: {
                                ...(prev?.groupsByGrouping || {}),
                                [grouping]: groups
                            },
                            overallStats: prev?.overallStats || null
                        };
                        setCachedSidebarData(user.uid, settings.scrambleType, updated);
                        return updated;
                    });
                }
            } catch (err) {
                console.warn('Failed to load logs sidebar groups:', err);
            } finally {
                if (isMounted) setGroupsLoading(false);
            }
        };

        fetchGroups();
        return () => { isMounted = false; };
    }, [user?.uid, settings.scrambleType, grouping]);

    // Fetch bottom footer stats from Cloud Function
    const selectedKeyArray = useMemo(() => Array.from(selectedKeys), [selectedKeys]);

    useEffect(() => {
        if (!user) {
            setServerStats(null);
            setStatsLoading(false);
            return;
        }

        let isMounted = true;
        const fetchStats = async () => {
            setStatsLoading(true);
            try {
                const fn = httpsCallable(functions, 'getLogsBottomStats');
                const res = await fn({
                    scrambleType: settings.scrambleType,
                    grouping,
                    selectedKeys: selectedKeyArray
                });
                const stats = (res.data as { stats: SidebarOverallStats | null }).stats || null;
                if (isMounted) {
                    setServerStats(stats);
                    if (selectedKeyArray.length === 0 && stats) {
                        setCachedData(prev => {
                            const updated: SidebarCachedData = {
                                groupsByGrouping: prev?.groupsByGrouping || {},
                                overallStats: stats
                            };
                            setCachedSidebarData(user.uid, settings.scrambleType, updated);
                            return updated;
                        });
                    }
                }
            } catch (err) {
                console.warn('Failed to load logs bottom stats:', err);
            } finally {
                if (isMounted) setStatsLoading(false);
            }
        };

        fetchStats();
        return () => { isMounted = false; };
    }, [user?.uid, settings.scrambleType, grouping, selectedKeyArray]);

    const displayItems: SidebarGroupItem[] = useMemo(() => {
        if (serverGroups) return serverGroups;
        if (cachedData?.groupsByGrouping?.[grouping]) {
            return cachedData.groupsByGrouping[grouping];
        }
        return [];
    }, [serverGroups, cachedData, grouping]);

    const selectedStats: SidebarOverallStats | null = useMemo(() => {
        if (serverStats !== null) return serverStats;
        if (selectedKeys.size === 0 && cachedData?.overallStats) {
            return cachedData.overallStats;
        }
        return null;
    }, [serverStats, selectedKeys.size, cachedData?.overallStats]);

    const formatDuration = (ms?: number | null) => {
        if (typeof ms !== 'number' || isNaN(ms)) return '0s';
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

    const isGroupsSkeleton = groupsLoading && displayItems.length === 0;
    const isStatsSkeleton = statsLoading && !selectedStats;

    return (
        <aside className="h-full bg-bg-secondary w-full select-none flex flex-col text-sm overflow-hidden min-w-0 font-sans">
            {/* Header Area: Event & Grouping Selectors in same row */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border/50 bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10 text-text-primary divide-y md:divide-y-0 md:divide-x divide-border/40">
                {/* Event Selector */}
                <div className="p-2 flex items-center justify-center relative group">
                    <div className="inline-flex items-center justify-center relative max-w-full">
                        <select
                            value={settings.scrambleType}
                            onChange={(e) => {
                                updateSettings({ scrambleType: e.target.value });
                                e.target.blur();
                            }}
                            className="appearance-none bg-transparent font-bold hover:text-accent outline-none focus:outline-none focus:ring-0 cursor-pointer text-center text-xs w-full pr-5 z-10"
                        >
                            {availableEventOptions.map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-bg-secondary text-text-primary">{opt.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 shrink-0" />
                    </div>
                </div>

                {/* Grouping Selector */}
                <div className="hidden md:flex p-2 items-center justify-center relative group">
                    <select
                        value={grouping}
                        onChange={(e) => {
                            setGrouping(e.target.value as GroupingType);
                            e.target.blur();
                        }}
                        className="appearance-none bg-transparent font-bold hover:text-accent outline-none focus:outline-none focus:ring-0 cursor-pointer text-center text-xs w-full pr-3 z-10"
                    >
                        {GROUPING_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-bg-secondary text-text-primary">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>
            </div>

            {/* Sub-Header: Full Row Stat Filter Dropdown */}
            <div className="hidden md:flex px-3 py-2 border-b border-border/30 bg-bg-secondary/30 relative items-center">
                <select
                    value={statColumn}
                    onChange={(e) => {
                        setStatColumn(e.target.value as StatColumn);
                        e.target.blur();
                    }}
                    className="appearance-none bg-transparent hover:text-accent font-bold text-xs cursor-pointer outline-none focus:outline-none focus:ring-0 w-full text-left uppercase pr-6 z-10"
                >
                    {COLUMN_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-bg-secondary text-text-primary">
                            {opt.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-3 pointer-events-none opacity-60 text-text-secondary" />
            </div>

            {/* List Content */}
            <div className="hidden md:block flex-1 overflow-y-auto custom-scrollbar relative">
                {/* Visible Loading Indicator Block while data is being pulled */}
                {groupsLoading && displayItems.length === 0 && (
                    <div className="p-3 m-2.5 rounded-xl bg-accent/10 border border-accent/25 flex items-start gap-2.5 shadow-xs animate-in fade-in duration-200">
                        <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0 mt-0.5" />
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-text-primary">Pulling logs data...</span>
                            <span className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                                Retrieving your sessions and statistics from the cloud.
                            </span>
                        </div>
                    </div>
                )}

                {isGroupsSkeleton ? (
                    <div className="flex flex-col divide-y divide-border/10">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-3">
                                <span className="inline-block h-3.5 w-24 bg-text-secondary/20 rounded animate-pulse" />
                                <span className="inline-block h-3.5 w-10 bg-text-secondary/20 rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : displayItems.length === 0 ? (
                    <div className="p-8 text-center text-text-secondary italic text-xs">No data found.</div>
                ) : (
                    displayItems.map(item => {
                        const isSelected = selectedKeys.has(item.key);
                        return (
                            <div
                                key={item.key}
                                onClick={() => handleSelect(item.key)}
                                className={`flex items-center px-3 py-2.5 border-b border-border/10 hover:bg-bg-hover transition-colors cursor-pointer group overflow-hidden
                                    ${isSelected ? 'bg-accent/10 border-l-2 border-l-accent pl-[10px]' : 'border-l-2 border-l-transparent'}
                                `}
                            >
                                {/* Checkbox: Only occupies space when selected or on hover, causing text to jump right */}
                                <div
                                    className={`flex items-center justify-center transition-all duration-200 ease-out shrink-0 overflow-hidden
                                        ${isSelected
                                            ? 'w-4 h-4 mr-2.5 opacity-100 scale-100'
                                            : 'w-0 h-4 mr-0 opacity-0 scale-0 group-hover:w-4 group-hover:mr-2.5 group-hover:opacity-100 group-hover:scale-100'
                                        }
                                    `}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(item.key);
                                    }}
                                    title={isSelected ? "Deselect group" : "Select group"}
                                >
                                    <div
                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                                            ${isSelected
                                                ? 'bg-accent border-accent text-white shadow-sm'
                                                : 'border-border hover:border-accent'
                                            }
                                        `}
                                    >
                                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                </div>

                                {/* Label: Jumps to the right when checkbox space appears */}
                                <div className="min-w-0 flex-1 transition-all duration-200">
                                    <span className={`font-medium text-xs sm:text-sm truncate block transition-colors duration-200 ${isSelected ? 'text-accent font-semibold' : 'text-text-primary'}`}>
                                        {item.label}
                                    </span>
                                </div>

                                {/* Stat Value */}
                                <div className="flex items-center justify-end font-mono text-xs sm:text-sm text-text-primary min-w-[55px] shrink-0 ml-2">
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
            <div className="hidden md:flex border-t border-border bg-bg-secondary p-3 flex-col gap-2">
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

                {isStatsSkeleton ? (
                    <div className="flex flex-col gap-1.5 text-xs px-1">
                        {['Solves', 'Time', 'Mean', 'Std Dev', 'Best', 'Ao5', 'Ao12', 'Ao100'].map(label => (
                            <div key={label} className="flex justify-between items-center py-0.5">
                                <span className="text-text-secondary/60 text-xs">{label}</span>
                                <span className="inline-block h-3 w-12 bg-text-secondary/20 rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : selectedStats ? (
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
