import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { format, subDays, eachDayOfInterval } from 'date-fns';

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { OfflineState } from '../components/ui/OfflineState';
import {
    getCachedDailyVolumeSync,
    getCachedDailyVolume,
    setCachedDailyVolume,
    DAILY_VOLUME_CACHE_EXPIRED_EVENT,
    type DailyVolumeData
} from '../utils/dailyVolumeCache';

interface ActivityTooltipData {
    date: Date;
    count: number;
    dist: Record<string, number>;
    left: number;
    top: number;
    placement: 'top' | 'bottom';
    arrowOffset: number;
}

function ActivitySquares({ userId, isGuestPreview }: { userId?: string, isGuestPreview?: boolean }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [tooltipData, setTooltipData] = useState<ActivityTooltipData | null>(null);
    const [dailyData, setDailyData] = useState<DailyVolumeData | null>(() => {
        if (isGuestPreview) return null;
        return getCachedDailyVolumeSync(userId);
    });
    const [isLoading, setIsLoading] = useState<boolean>(() => {
        if (isGuestPreview) return false;
        return !getCachedDailyVolumeSync(userId) && !!userId;
    });

    const today = new Date();
    // E.g., past 150 days
    const pastDays = useMemo(() => eachDayOfInterval({ start: subDays(today, 150), end: today }), []);

    useEffect(() => {
        if (isGuestPreview) {
            const fakeData: DailyVolumeData = { dailySolvesCount: {}, dailySolvesByEvent: {} };
            pastDays.forEach((d, i) => {
                const dateStr = format(d, 'yyyy-MM-dd');
                if (i % 3 === 0 || i % 7 === 0) {
                    const count = (i % 5) * 15 + (i % 3) * 5 + 10;
                    fakeData.dailySolvesCount[dateStr] = count;
                    fakeData.dailySolvesByEvent[dateStr] = { '333': count };
                }
            });
            setDailyData(fakeData);
            setIsLoading(false);
            return;
        }

        if (!userId) {
            setDailyData(null);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        const fetchDaily = async (force = false) => {
            if (!force) {
                const cached = await getCachedDailyVolume(userId);
                if (cached && isMounted) {
                    setDailyData(cached);
                    setIsLoading(false);
                    return;
                }
            }
            setIsLoading(true);
            try {
                const fn = httpsCallable(functions, 'getDailyVolumeStats');
                const res = await fn();
                const data = res.data as DailyVolumeData;
                if (isMounted) {
                    setDailyData(data);
                    await setCachedDailyVolume(userId, data);
                }
            } catch (e) {
                console.warn('Failed to load daily volume stats:', e);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchDaily();

        const handleExpired = () => {
            fetchDaily(true);
        };

        window.addEventListener(DAILY_VOLUME_CACHE_EXPIRED_EVENT, handleExpired);
        return () => {
            isMounted = false;
            window.removeEventListener(DAILY_VOLUME_CACHE_EXPIRED_EVENT, handleExpired);
        };
    }, [userId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
    }, [dailyData, isLoading]);

    useEffect(() => {
        const handleScroll = () => setTooltipData(null);
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, []);

    const handleMouseEnter = (
        e: React.MouseEvent<HTMLDivElement>,
        date: Date,
        count: number,
        dist: Record<string, number>
    ) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const squareCenterX = rect.left + rect.width / 2;

        const minCenter = 80;
        const maxCenter = Math.max(minCenter, window.innerWidth - 80);
        const clampedLeft = Math.max(minCenter, Math.min(maxCenter, squareCenterX));
        const arrowOffset = Math.max(-60, Math.min(60, squareCenterX - clampedLeft));

        const spaceAbove = rect.top;
        const placement: 'top' | 'bottom' = spaceAbove >= 120 ? 'top' : 'bottom';
        const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;

        setTooltipData({
            date,
            count,
            dist,
            left: clampedLeft,
            top,
            placement,
            arrowOffset
        });
    };

    const handleMouseLeave = () => {
        setTooltipData(null);
    };

    return (
        <div className="w-full relative">
            <div 
                ref={scrollRef} 
                onScroll={() => setTooltipData(null)}
                className="w-full overflow-x-auto no-scrollbar py-2"
            >
                <div className="flex gap-1.5 min-w-max px-1">
                    {isLoading && !dailyData ? (
                        pastDays.map(date => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            return (
                                <div
                                    key={dateStr}
                                    className="w-7 h-7 rounded-md bg-text-secondary/20 animate-pulse shrink-0"
                                />
                            );
                        })
                    ) : (
                        pastDays.map(date => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const count = dailyData?.dailySolvesCount?.[dateStr] || 0;
                            const dist = dailyData?.dailySolvesByEvent?.[dateStr] || {};

                            let bgColor = 'bg-bg-secondary border border-border/50';
                            if (count > 0) bgColor = 'bg-accent/20 text-accent border border-accent/20';
                            if (count > 10) bgColor = 'bg-accent/50 text-white border border-accent/30';
                            if (count > 30) bgColor = 'bg-accent/80 text-white border border-accent/40';
                            if (count > 70) bgColor = 'bg-accent text-white border border-accent';

                            return (
                                <div 
                                    key={dateStr}
                                    onMouseEnter={(e) => handleMouseEnter(e, date, count, dist)}
                                    onMouseLeave={handleMouseLeave}
                                    className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold transition-transform duration-150 cursor-default hover:scale-110 ${bgColor}`}
                                >
                                    {count > 0 ? count : ''}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Portal Hover Tooltip rendering outside scroll container / divs */}
            {tooltipData && typeof document !== 'undefined' && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: `${tooltipData.left}px`,
                        top: `${tooltipData.top}px`,
                        transform: tooltipData.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                        zIndex: 9999
                    }}
                    className="pointer-events-none flex flex-col items-center animate-in fade-in zoom-in-95 duration-75"
                >
                    {tooltipData.placement === 'bottom' && (
                        <div 
                            style={{ transform: `translateX(${tooltipData.arrowOffset}px) rotate(45deg)` }}
                            className="w-2 h-2 bg-bg-hover border-t border-l border-border -mb-1 shadow-sm z-10" 
                        />
                    )}
                    <div className="bg-bg-hover text-text-primary text-xs px-3 py-2 rounded-lg border border-border shadow-[0_4px_20px_rgba(0,0,0,0.5)] whitespace-nowrap flex flex-col gap-1 min-w-[120px]">
                        <span className="font-semibold">{format(tooltipData.date, 'MMM d, yyyy')}</span>
                        <span className="text-text-secondary">{tooltipData.count} total solves</span>
                        {Object.keys(tooltipData.dist).length > 0 && (
                            <div className="flex flex-col mt-1 pt-1 border-t border-border/50 text-[10px] text-text-secondary">
                                {Object.entries(tooltipData.dist).map(([ev, evCount]) => (
                                    <div key={ev} className="flex justify-between gap-3">
                                        <span className="uppercase">{ev}</span>
                                        <span>{evCount as number}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {tooltipData.placement === 'top' && (
                        <div 
                            style={{ transform: `translateX(${tooltipData.arrowOffset}px) rotate(45deg)` }}
                            className="w-2 h-2 bg-bg-hover border-b border-r border-border -mt-1 shadow-[4px_4px_4px_rgba(0,0,0,0.1)] z-10" 
                        />
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
import {
    Target,
    Clock,
    Flame,
    Layers,
    Award,
    Pin,
    PinOff,
    CheckCircle2,
    TrendingUp,
    Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSolves } from '../contexts/SolvesContext';
import { useGoals } from '../contexts/GoalsContext';
import type { GoalCategory } from '../types/goals';
import { CATEGORY_METADATA } from '../utils/goalsCalculations';
import RecordTable from '../components/records/RecordTable';

type StatusFilter = 'all' | 'completed' | 'in-progress';

export default function Goals() {
    const isOnline = useOnlineStatus();
    const { user } = useAuth();
    const { userStats, solves } = useSolves();
    const {
        goalsProgress,
        pinnedGoals,
        totalGoalsCount,
        totalCompletedCount,
        overallCompletionPercent,
        globalStats,
        getGoalGlobalPercentage,
        pinGoal,
        unpinGoal,
        isGoalPinned,
        selectedCategory,
        setSelectedCategory,
        statusFilter,
        setStatusFilter
    } = useGoals();

    const navigate = useNavigate();

    const [pinNotice, setPinNotice] = useState<string | null>(null);

    const isGuestPreview = user?.isAnonymous;

    const displayGoalsProgress = useMemo(() => {
        if (!isGuestPreview) return goalsProgress;
        
        // Generate filler data for preview
        return goalsProgress.map((g, i) => {
            const mockPercent = i % 4 === 0 ? 100 : (i % 3 === 0 ? 60 : (i % 2 === 0 ? 25 : 0));
            let mockCurrent = (g.targetValue * mockPercent) / 100;
            return {
                ...g,
                currentValue: mockCurrent,
                percentCompleted: mockPercent,
                completed: mockPercent === 100,
                displayCurrent: g.category === 'time' ? `${mockCurrent}s` : String(Math.floor(mockCurrent))
            };
        });
    }, [goalsProgress, isGuestPreview]);

    const displayTotalCompleted = isGuestPreview ? displayGoalsProgress.filter(g => g.completed).length : totalCompletedCount;
    const displayOverallPercent = isGuestPreview && totalGoalsCount > 0 ? Math.round((displayTotalCompleted / totalGoalsCount) * 100) : overallCompletionPercent;

    const handlePinToggle = async (goalId: string) => {
        if (isGuestPreview) {
            setPinNotice("Create an account to pin goals.");
            setTimeout(() => setPinNotice(null), 4000);
            return;
        }
        if (!user) {
            navigate('/account', { state: { mode: 'signin' } });
            return;
        }

        if (isGoalPinned(goalId)) {
            await unpinGoal(goalId);
        } else {
            const success = await pinGoal(goalId);
            if (!success) {
                setPinNotice("You can pin up to 3 goals. Unpin a goal first to pin this one.");
                setTimeout(() => setPinNotice(null), 4000);
            }
        }
    };

    // Filter and sort goals
    const filteredGoals = useMemo(() => {
        const filtered = displayGoalsProgress.filter(goal => {
            // Category filter
            if (selectedCategory !== 'all' && goal.category !== selectedCategory) {
                return false;
            }

            // Status filter
            if (statusFilter === 'completed' && !goal.completed) return false;
            if (statusFilter === 'in-progress' && goal.completed) return false;

            return true;
        });

        if (selectedCategory === 'all') {
            return [...filtered].sort((a, b) => b.percentCompleted - a.percentCompleted);
        }

        return filtered;
    }, [displayGoalsProgress, selectedCategory, statusFilter]);

    // Category progress breakdown
    const categoryStats = useMemo(() => {
        const categories: GoalCategory[] = ['time', 'count', 'streak', 'diversity'];
        return categories.map(cat => {
            const list = displayGoalsProgress.filter(g => g.category === cat);
            const comp = list.filter(g => g.completed).length;
            const pct = list.length > 0 ? Math.round((comp / list.length) * 100) : 0;
            return {
                category: cat,
                label: CATEGORY_METADATA[cat].label,
                total: list.length,
                completed: comp,
                percentage: pct
            };
        });
    }, [displayGoalsProgress]);

    // Global percentile calculation
    const globalPercentileText = useMemo(() => {
        if (!globalStats || !globalStats.totalGoalsCountDistribution) {
            return null;
        }

        const distribution = globalStats.totalGoalsCountDistribution;
        const distributionUserCount = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        const totalUsers = Math.max(globalStats.totalUsers || 0, distributionUserCount, 1);

        if (totalUsers === 0) return null;

        let usersWithFewerGoals = 0;
        Object.entries(distribution).forEach(([countStr, userCount]) => {
            const count = parseInt(countStr, 10);
            if (count < displayTotalCompleted) {
                usersWithFewerGoals += userCount;
            }
        });

        const percentile = Math.min(100, Math.max(0, Math.round((usersWithFewerGoals / totalUsers) * 100)));
        return percentile;
    }, [globalStats, displayTotalCompleted]);

    const getCategoryIcon = (cat: GoalCategory) => {
        switch (cat) {
            case 'time':
                return <Clock className="w-4 h-4" />;
            case 'count':
                return <Layers className="w-4 h-4" />;
            case 'streak':
                return <Flame className="w-4 h-4" />;
            case 'diversity':
                return <Award className="w-4 h-4" />;
        }
    };

    const activeEvents = useMemo(() => {
        const fromStats = userStats?.validSolvesPerEvent
            ? Object.entries(userStats.validSolvesPerEvent)
                .filter(([_, count]) => (count as number) > 0)
                .map(([e]) => e)
            : [];
        const fromSolves = (solves || []).map(s => s.scrambleType || '333');
        const combined = Array.from(new Set([...fromStats, ...fromSolves]));
        return combined.length > 0 ? combined : undefined;
    }, [userStats?.validSolvesPerEvent, solves]);

    if (!isOnline) {
        return <OfflineState featureName="Goals & Achievements" />;
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-bg-primary overflow-y-auto custom-scrollbar select-none">
            <div className="max-w-6xl w-full mx-auto px-1.5 py-2.5 sm:px-3 sm:py-3 md:px-4 md:py-4 flex flex-col gap-5">

                {isGuestPreview && (
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-3">
                            <div>
                                <h2 className="text-sm font-bold text-text-primary">Goals Page Preview</h2>
                                <p className="text-xs text-text-secondary mt-0.5">
                                    Sign in to track your real progress and unlock milestones as you solve.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/account', { state: { mode: 'signin' } })}
                            className="w-full sm:w-auto px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                        >
                            Sign In
                        </button>
                    </div>
                )}

                {/* ACTIVITY SQUARES */}
                <ActivitySquares userId={user?.uid} isGuestPreview={isGuestPreview} />

                {/* PERSONAL RECORDS TABLE */}
                <RecordTable activeEvents={activeEvents} />

                {/* HEADER OVERVIEW STATS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Main Progress Card */}
                    <div className="lg:col-span-2 bg-surface-elevation-1 border border-border rounded-xl p-5 flex flex-col justify-between gap-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-lg font-bold text-text-primary tracking-tight">Goals and Milestones</h1>
                                <p className="text-xs text-text-secondary">
                                    Track your speedcubing journey across volume, time, streaks, and disciplines.
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="font-mono text-xl font-bold text-text-primary">
                                    {displayTotalCompleted} <span className="text-xs text-text-secondary font-normal">/ {totalGoalsCount}</span>
                                </span>
                                <div className="text-[11px] text-accent font-semibold">
                                    {displayOverallPercent}% Completed
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="flex flex-col gap-1.5">
                            <div className="w-full h-2.5 bg-bg-secondary rounded-full overflow-hidden border border-border/50">
                                <div
                                    className="h-full bg-accent transition-all duration-500 rounded-full"
                                    style={{ width: `${Math.max(1, displayOverallPercent)}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-text-secondary">
                                <span>{displayTotalCompleted} completed</span>
                                <span>{totalGoalsCount - displayTotalCompleted} remaining</span>
                            </div>
                        </div>

                        {/* Global Community Standing */}
                        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-text-secondary">
                            <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-text-secondary" />
                                <span>Community Stats</span>
                            </div>
                            {globalPercentileText !== null ? (
                                <div className="flex items-center gap-1 text-text-primary font-medium">
                                    <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                                    <span>Ahead of {globalPercentileText}% of registered solvers</span>
                                </div>
                            ) : (
                                <span>Calculated across all registered accounts</span>
                            )}
                        </div>
                    </div>

                    {/* Category Breakdown Sidebar */}
                    <div className="bg-surface-elevation-1 border border-border rounded-xl p-4 flex flex-col justify-between gap-3">
                        <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                            Categories
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {categoryStats.map(stat => (
                                <div
                                    key={stat.category}
                                    onClick={() => setSelectedCategory(stat.category)}
                                    className={`p-2 rounded-lg cursor-pointer transition-colors border ${selectedCategory === stat.category ? 'bg-bg-hover border-accent/40' : 'border-transparent hover:bg-bg-hover/50'}`}
                                >
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <div className="flex items-center gap-1.5 font-medium text-text-primary">
                                            {getCategoryIcon(stat.category)}
                                            <span>{stat.label}</span>
                                        </div>
                                        <span className="font-mono text-text-secondary text-[11px]">
                                            {stat.completed}/{stat.total}
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-accent transition-all duration-300"
                                            style={{ width: `${stat.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* PIN NOTICE TOAST */}
                {pinNotice && (
                    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between">
                        <span>{pinNotice}</span>
                        <button onClick={() => setPinNotice(null)} className="underline ml-2">Dismiss</button>
                    </div>
                )}

                {/* PINNED GOALS SECTION */}
                {pinnedGoals.length > 0 && (
                    <div className="bg-surface-elevation-1 border border-border/80 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Pin className="w-4 h-4 text-accent" />
                                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                                    Pinned Goals ({pinnedGoals.length} / 3)
                                </h2>
                            </div>
                            <span className="text-[11px] text-text-secondary">
                                Displayed at the top of your practice timer
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {pinnedGoals.map(goal => (
                                <div
                                    key={goal.goalId}
                                    className="bg-bg-secondary border border-border/60 rounded-lg p-3 flex flex-col justify-between gap-2"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                {goal.completed && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                                                <span className="font-semibold text-xs text-text-primary truncate">
                                                    {goal.title}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">
                                                {goal.description}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => unpinGoal(goal.goalId)}
                                            className="p-1 text-text-secondary hover:text-red-500 transition-colors shrink-0"
                                            title="Unpin goal"
                                        >
                                            <PinOff className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary mb-1">
                                            <span>{goal.displayCurrent}</span>
                                            <span>{goal.displayTarget}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-bg-primary rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${goal.completed ? 'bg-green-500' : 'bg-accent'}`}
                                                style={{ width: `${goal.percentCompleted}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CONTROLS & FILTER BAR */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    {/* Category Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${selectedCategory === 'all' ? 'bg-accent text-white' : 'bg-surface-elevation-1 text-text-secondary hover:text-text-primary border border-border'}`}
                        >
                            All Goals ({totalGoalsCount})
                        </button>
                        {(['time', 'count', 'streak', 'diversity'] as GoalCategory[]).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${selectedCategory === cat ? 'bg-accent text-white' : 'bg-surface-elevation-1 text-text-secondary hover:text-text-primary border border-border'}`}
                            >
                                {getCategoryIcon(cat)}
                                <span>{CATEGORY_METADATA[cat].label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as StatusFilter);
                            }}
                            className="bg-surface-elevation-1 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary outline-none focus:outline-none focus:ring-0 cursor-pointer font-medium"
                        >
                            <option value="all">All Status</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Complete</option>
                        </select>
                    </div>
                </div>

                {/* GOALS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
                    {user && displayGoalsProgress.length === 0 ? (
                        Array.from({ length: 6 }).map((_, idx) => (
                            <div
                                key={idx}
                                className="bg-surface-elevation-1 border border-border/60 rounded-xl p-4 flex flex-col justify-between gap-3 animate-pulse"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-text-secondary/20 shrink-0 mt-0.5" />
                                        <div className="min-w-0 flex flex-col gap-2">
                                            <div className="h-4 w-32 bg-text-secondary/20 rounded" />
                                            <div className="h-3 w-56 bg-text-secondary/20 rounded" />
                                        </div>
                                    </div>
                                    <div className="w-6 h-6 rounded bg-text-secondary/20 shrink-0" />
                                </div>
                                <div className="flex flex-col gap-1.5 mt-2">
                                    <div className="flex items-center justify-between">
                                        <div className="h-3 w-12 bg-text-secondary/20 rounded" />
                                        <div className="h-3 w-16 bg-text-secondary/20 rounded" />
                                    </div>
                                    <div className="w-full h-2 bg-text-secondary/20 rounded-full" />
                                </div>
                            </div>
                        ))
                    ) : (
                        filteredGoals.map((goal) => {
                            const isPinned = isGoalPinned(goal.goalId);
                            const globalPct = getGoalGlobalPercentage(goal.goalId);

                        return (
                            <div
                                key={goal.goalId}
                                className={`bg-surface-elevation-1 border rounded-xl p-4 flex flex-col justify-between gap-3 transition-all ${goal.completed ? 'border-border/80 hover:border-green-500/40' : 'border-border/60 hover:border-border'}`}
                            >
                                {/* Top Row: Title, Category, Action */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${goal.completed ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-bg-secondary text-text-secondary border border-border'}`}>
                                            {goal.completed ? (
                                                <CheckCircle2 className="w-4 h-4" />
                                            ) : (
                                                getCategoryIcon(goal.category)
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-sm text-text-primary truncate">
                                                    {goal.title}
                                                </h3>
                                            </div>
                                            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                                                {goal.description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Pin Button */}
                                    <button
                                        onClick={() => handlePinToggle(goal.goalId)}
                                        className={`p-1.5 rounded-md border transition-colors shrink-0 ${isPinned ? 'bg-accent text-white border-accent' : 'border-border/60 text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}
                                        title={isPinned ? "Unpin from practice page" : "Pin to practice page (max 3)"}
                                    >
                                        <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                                    </button>
                                </div>

                                {/* Streak Date Range */}
                                {goal.category === 'streak' && goal.streakStartDate && goal.streakEndDate && goal.currentValue > 0 && (
                                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-secondary bg-bg-secondary/60 px-2.5 py-1 rounded-md border border-border/40 w-fit">
                                        <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                                        <span>
                                            Best streak: {goal.streakStartDate === goal.streakEndDate ? goal.streakStartDate : `${goal.streakStartDate} – ${goal.streakEndDate}`}
                                        </span>
                                    </div>
                                )}

                                {/* Progress Bar & Metrics */}
                                <div className="flex flex-col gap-1.5 pt-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-mono text-text-secondary text-[11px]">
                                            {goal.displayCurrent} <span className="opacity-50">/ {goal.displayTarget}</span>
                                        </span>
                                        <span className={`font-mono text-xs font-semibold ${goal.completed ? 'text-green-500' : 'text-text-primary'}`}>
                                            {goal.completed ? 'Completed' : `${goal.percentCompleted}%`}
                                        </span>
                                    </div>

                                    <div className="w-full h-2 bg-bg-secondary rounded-full overflow-hidden border border-border/40">
                                        <div
                                            className={`h-full transition-all duration-300 rounded-full ${goal.completed ? 'bg-green-500' : 'bg-accent'}`}
                                            style={{ width: `${goal.percentCompleted}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Footer: Global Solver Stats */}
                                <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-text-secondary">
                                    <span className="capitalize text-text-secondary/70">
                                        {CATEGORY_METADATA[goal.category].label}
                                    </span>
                                    <div className="flex items-center gap-1 font-medium text-text-secondary">
                                        <Users className="w-3 h-3 text-text-secondary/60" />
                                        <span>{globalPct}% of solvers</span>
                                    </div>
                                </div>
                            </div>
                        );
                    }))}

                    {filteredGoals.length === 0 && (
                        <div className="col-span-full py-16 flex flex-col items-center justify-center text-center gap-2">
                            <Target className="w-8 h-8 text-text-secondary opacity-30" />
                            <p className="text-sm text-text-secondary">No matching goals found.</p>
                            <button
                                onClick={() => {
                                    setSelectedCategory('all');
                                    setStatusFilter('all');
                                }}
                                className="text-xs text-accent underline mt-1 cursor-pointer"
                            >
                                Clear filters
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
