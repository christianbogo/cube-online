import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useGoals } from '../contexts/GoalsContext';
import type { GoalCategory } from '../types/goals';
import { CATEGORY_METADATA } from '../utils/goalsCalculations';
import RecordTable from '../components/records/RecordTable';

type StatusFilter = 'all' | 'completed' | 'in-progress';

export default function Goals() {
    const { user } = useAuth();
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

    const handlePinToggle = async (goalId: string) => {
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

    // Filter goals
    const filteredGoals = useMemo(() => {
        return goalsProgress.filter(goal => {
            // Category filter
            if (selectedCategory !== 'all' && goal.category !== selectedCategory) {
                return false;
            }

            // Status filter
            if (statusFilter === 'completed' && !goal.completed) return false;
            if (statusFilter === 'in-progress' && goal.completed) return false;

            return true;
        });
    }, [goalsProgress, selectedCategory, statusFilter]);

    // Category progress breakdown
    const categoryStats = useMemo(() => {
        const categories: GoalCategory[] = ['time', 'count', 'streak', 'diversity'];
        return categories.map(cat => {
            const list = goalsProgress.filter(g => g.category === cat);
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
    }, [goalsProgress]);

    // Global percentile calculation
    const globalPercentileText = useMemo(() => {
        if (!globalStats || !globalStats.totalUsers || !globalStats.totalGoalsCountDistribution) {
            return null;
        }

        const totalUsers = globalStats.totalUsers;
        let usersWithFewerGoals = 0;

        Object.entries(globalStats.totalGoalsCountDistribution).forEach(([countStr, userCount]) => {
            const count = parseInt(countStr, 10);
            if (count < totalCompletedCount) {
                usersWithFewerGoals += userCount;
            }
        });

        const percentile = Math.round((usersWithFewerGoals / totalUsers) * 100);
        return percentile;
    }, [globalStats, totalCompletedCount]);

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

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-bg-primary overflow-y-auto custom-scrollbar select-none">
            <div className="max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">

                {/* PERSONAL RECORDS TABLE */}
                <RecordTable />

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
                                    {totalCompletedCount} <span className="text-xs text-text-secondary font-normal">/ {totalGoalsCount}</span>
                                </span>
                                <div className="text-[11px] text-accent font-semibold">
                                    {overallCompletionPercent}% Completed
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="flex flex-col gap-1.5">
                            <div className="w-full h-2.5 bg-bg-secondary rounded-full overflow-hidden border border-border/50">
                                <div
                                    className="h-full bg-accent transition-all duration-500 rounded-full"
                                    style={{ width: `${Math.max(1, overallCompletionPercent)}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-text-secondary">
                                <span>{totalCompletedCount} completed</span>
                                <span>{totalGoalsCount - totalCompletedCount} remaining</span>
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
                                e.target.blur();
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
                    {filteredGoals.map((goal) => {
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
                    })}

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
