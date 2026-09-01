import { useSolves, type Solve } from '../../contexts/SolvesContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSession } from '../../contexts/SessionContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Trash2, ChevronLeft, ChevronRight, EyeOff, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { calculateBestAverage, calculateBestSingle, formatTime, calculateAverage } from '../../utils/calculations';
import { SCRAMBLE_TYPES } from '../../utils/constants';

export interface RightSidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
}

type StatsMode = 'best' | 'session';

export default function RightSidebar({ onToggleCollapse, collapsed }: RightSidebarProps) {
    const { solves: allSolves, updateSolve, deleteSolve, isPrivateMode, togglePrivateMode } = useSolves();
    const { user } = useAuth();
    const { currentSessionId } = useSession();
    const { settings, updateSettings } = useSettings();

    // -- Derived State --
    const isLocalExperience = !user || isPrivateMode;

    // Filter Solves
    const displaySolves = useMemo(() => {
        if (isLocalExperience) {
            return allSolves.filter(s => (s.scrambleType || '333') === settings.scrambleType);
        } else {
            return allSolves.filter(s => s.userId === user?.uid && (s.scrambleType || '333') === settings.scrambleType);
        }
    }, [allSolves, isLocalExperience, user, settings.scrambleType]);

    // -- Pagination --
    const [pageLimit, setPageLimit] = useState(100);
    const paginatedSolves = useMemo(() => {
        return displaySolves.slice(0, pageLimit);
    }, [displaySolves, pageLimit]);

    const hasMore = displaySolves.length > pageLimit;

    const handleLoadMore = () => {
        setPageLimit(prev => prev + 100);
    };

    // -- Stats Calculation --
    const [statsMode, setStatsMode] = useState<StatsMode>('best');

    const currentSessionSolves = useMemo(() => {
        if (isPrivateMode) return displaySolves;
        if (!currentSessionId) return [];
        return displaySolves.filter(s => s.sessionId === currentSessionId);
    }, [displaySolves, currentSessionId, isPrivateMode]);

    const stats = useMemo(() => {
        const activeSolves = currentSessionSolves;
        const totalSolves = displaySolves;

        const cs = (size: number) => calculateAverage(activeSolves, size);
        const cbs = (size: number) => calculateBestAverage(activeSolves, size);
        const bs = (size: number) => calculateBestAverage(totalSolves, size);

        return {
            current: {
                single: calculateAverage(activeSolves, 1),
                ao5: cs(5),
                ao12: cs(12),
                ao100: cs(100),
                ao1000: totalSolves.length >= 1000 ? cs(1000) : null
            },
            sessionBest: {
                single: calculateBestSingle(activeSolves),
                ao5: cbs(5),
                ao12: cbs(12),
                ao100: cbs(100),
                ao1000: activeSolves.length >= 1000 ? cbs(1000) : null
            },
            allTimeBest: {
                single: calculateBestSingle(totalSolves),
                ao5: bs(5),
                ao12: bs(12),
                ao100: bs(100),
                ao1000: totalSolves.length >= 1000 ? bs(1000) : null
            }
        };
    }, [currentSessionSolves, displaySolves]);

    // -- UI Helpers --
    const [expandedSolveId, setExpandedSolveId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedSolveId(prev => (prev === id ? null : id));
    };

    const handleDeleteSolve = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        deleteSolve(id);
    };

    const handlePenalty = (id: string, type: '+2' | 'DNF', currentPenalty: string, e: React.MouseEvent) => {
        e.stopPropagation();
        let newPenalty: 'none' | '+2' | 'DNF' = 'none';
        if (currentPenalty !== type) {
            newPenalty = type;
        }
        updateSolve(id, { penalty: newPenalty });
    };

    const copyScramble = (scramble: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(scramble);
    };

    if (collapsed) {
        return (
            <aside className="h-full bg-bg-secondary w-[50px] flex flex-col border-l border-border transition-all duration-300">
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center py-4 gap-1">
                    {currentSessionSolves.map(solve => (
                        <div key={solve.id} className="w-3 h-1.5 rounded-[1px] bg-text-secondary/20" title={formatTime(solve.time)} />
                    ))}
                </div>

                <div className="p-2 border-t border-border flex flex-col gap-2 items-center">
                    {user && (
                        <button
                            onClick={togglePrivateMode}
                            onFocus={(e) => e.target.blur()}
                            className={`w-full flex items-center justify-center p-1 rounded-md transition-colors
                                ${isPrivateMode ? 'text-accent bg-bg-tertiary shadow-inner' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
                            title={isPrivateMode ? "Exit Private Session" : "Enter Private Session"}
                        >
                            <EyeOff className={`w-5 h-5 ${isPrivateMode ? 'animate-pulse' : ''}`} />
                        </button>
                    )}

                    <button
                        onClick={onToggleCollapse}
                        className="w-full flex items-center justify-center p-2 rounded-md hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
                        title="Expand Sidebar ([)"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                </div>
            </aside>
        );
    }

    const bestStats = statsMode === 'session' ? stats.sessionBest : stats.allTimeBest;

    return (
        <aside className="h-full bg-bg-secondary w-full select-none flex flex-col text-text-secondary text-sm overflow-hidden min-w-0 font-sans relative">
            {/* Header Area (Stats) */}
            <div className="flex flex-col border-b border-border bg-bg-secondary sticky top-0 z-10">
                {/* Event Selector */}
                <div className="p-2 border-b border-border/50 flex justify-center relative group">
                    <select
                        value={settings.scrambleType}
                        onChange={(e) => {
                            updateSettings({ scrambleType: e.target.value });
                            e.target.blur();
                        }}
                        className="appearance-none bg-transparent font-medium border-none hover:text-accent
                                outline-none focus:outline-none focus:ring-0 cursor-pointer text-center text-sm w-full z-10"
                    >
                        {SCRAMBLE_TYPES.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-bg-secondary text-text-primary">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>

                {/* Stats Table */}
                <div className="grid grid-cols-3 gap-y-2 gap-x-2 text-center text-xs p-4 items-center">
                    <div className="col-span-1"></div>
                    <div className="col-span-1 font-semibold text-text-secondary border-b border-transparent">Current</div>

                    {/* Toggle Header */}
                    <div
                        className="col-span-1 font-semibold text-text-primary border border-border/50 pb-1 pt-1 cursor-pointer hover:bg-white/5 transition-colors select-none rounded flex items-center justify-center gap-1"
                        onClick={() => setStatsMode(prev => prev === 'best' ? 'session' : 'best')}
                    >
                        {statsMode === 'best' ? 'Best' : 'Session'}
                    </div>

                    <StatItem label="Single" current={stats.current.single} best={bestStats.single} show={true} />
                    <StatItem label="mo3" current={null} best={null} show={false} />
                    <StatItem label="ao5" current={stats.current.ao5} best={bestStats.ao5} show={true} />
                    <StatItem label="ao12" current={stats.current.ao12} best={bestStats.ao12} show={true} />
                    <StatItem label="ao100" current={stats.current.ao100} best={bestStats.ao100} show={true} />
                </div>
            </div>

            {/* Solve List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Permanent Guest Solves Save Prompt */}
                {!user && !isPrivateMode && (
                    <div className="py-2 px-3 bg-accent/5 border-b border-border/40 text-center">
                        <Link
                            to="/account"
                            state={{ mode: 'signin' }}
                            className="text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors block"
                        >
                            Sign in to save solves
                        </Link>
                    </div>
                )}

                <div className="flex flex-col">
                    {paginatedSolves.map((solve, index) => {
                        const newerSolve = paginatedSolves[index - 1];
                        const showHeader = !newerSolve || (
                            (new Date(newerSolve.date).getTime() - new Date(solve.date).getTime() > 1000 * 60 * 60) ||
                            (newerSolve.sessionId !== solve.sessionId)
                        );

                        const solveNumber = displaySolves.length - index;

                        return (
                            <div key={solve.id}>
                                {showHeader && (
                                    <div className="py-2 pl-4 text-[10px] text-text-secondary/40 font-mono text-left">
                                        {new Date(solve.date).toLocaleString(undefined, {
                                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                        })}
                                    </div>
                                )}
                                <SolveItem
                                    solve={solve}
                                    number={solveNumber}
                                    expanded={expandedSolveId === solve.id}
                                    onToggle={() => toggleExpand(solve.id)}
                                    onDelete={handleDeleteSolve}
                                    onPenalty={handlePenalty}
                                    onCopy={copyScramble}
                                />
                            </div>
                        );
                    })}
                </div>

                {hasMore && (
                    <button
                        onClick={handleLoadMore}
                        className="w-full p-4 text-xs text-text-secondary hover:text-text-primary transition-colors border-t border-border/50"
                    >
                        Load 100 More
                    </button>
                )}

                {/* Empty State */}
                {displaySolves.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-text-secondary/50 gap-2 h-full">
                        <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mb-2">
                            <ChevronRight className="w-6 h-6 opacity-20" />
                        </div>
                        <span className="text-sm">No solves yet</span>
                        {!user && !isPrivateMode && <span className="text-xs opacity-50">Sign in to save solves.</span>}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-border flex flex-col gap-2">
                {user && (
                    <button
                        onClick={togglePrivateMode}
                        onFocus={(e) => e.target.blur()}
                        className={`w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium transition-colors border-b border-border/10
                            ${isPrivateMode ? 'text-text-primary bg-bg-tertiary shadow-inner' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
                        title={isPrivateMode ? "Exit Private Session" : "Enter Private Session"}
                    >
                        <EyeOff className={`w-3.5 h-3.5 ${isPrivateMode ? 'text-accent animate-pulse' : ''}`} />
                        {isPrivateMode ? 'Private Session Active' : 'Private Session'}
                    </button>
                )}

                <button
                    onClick={onToggleCollapse}
                    className={`w-full flex items-center justify-center p-2 rounded-md hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary`}
                    title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {collapsed ? (
                        <ChevronRight className="w-5 h-5" />
                    ) : (
                        <ChevronRight className="w-5 h-5" />
                    )}
                </button>
            </div>
        </aside>
    );
}

const StatItem = ({ label, current, best, show }: { label: string, current: any, best: any, show: boolean }) => {
    if (!show) return null;
    return (
        <>
            <div className="text-left pl-1 font-medium text-text-secondary py-1">{label}</div>
            <div className="font-mono text-text-primary py-1">{formatTime(current)}</div>
            <div className="font-mono text-text-primary py-1">
                {formatTime(best)}
            </div>
        </>
    );
};

interface SolveItemProps {
    solve: Solve;
    number: number;
    expanded: boolean;
    onToggle: () => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onPenalty: (id: string, type: '+2' | 'DNF', currentPenalty: string, e: React.MouseEvent) => void;
    onCopy: (scramble: string, e: React.MouseEvent) => void;
}

const SolveItem = ({ solve, number, expanded, onToggle, onDelete, onPenalty, onCopy }: SolveItemProps) => {
    const [isCopied, setIsCopied] = useState(false);

    const formatTimeDisplay = (solve: Solve) => {
        if (solve.penalty === 'DNF' || solve.inspectionPenalty === 'DNF') return 'DNF';
        let tVal = solve.time;
        if (solve.penalty === '+2') tVal += 2000;
        if (solve.inspectionPenalty === '+2') tVal += 2000;

        let tStr = '';
        const totalSeconds = tVal / 1000;
        if (totalSeconds < 60) {
            tStr = tVal === 0 ? '0.00' : (tVal / 1000).toFixed(2);
        } else {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = (totalSeconds % 60).toFixed(2);
            tStr = `${minutes}:${seconds.padStart(5, '0')}`;
        }

        let plusCount = 0;
        if (solve.penalty === '+2') plusCount++;
        if (solve.inspectionPenalty === '+2') plusCount++;
        if (plusCount === 1) tStr += '+';
        if (plusCount === 2) tStr += '++';
        return tStr;
    };

    const handleCopy = (e: React.MouseEvent) => {
        onCopy(solve.scramble, e);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div
            onClick={onToggle}
            className={`flex flex-col border-l-2 transition-colors cursor-pointer text-sm
                ${expanded ? 'bg-bg-hover/30 border-accent' : 'border-transparent hover:bg-bg-hover/30'}
            `}
        >
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-text-secondary/40 font-mono w-6 text-right text-[10px]">{number}</span>
                    <span className={`font-mono font-medium ${solve.penalty === 'DNF' ? 'text-red-500' : 'text-text-primary'}`}>
                        {formatTimeDisplay(solve)}
                    </span>
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-3 pt-1 flex flex-col gap-2 animate-in slide-in-from-top-1 duration-200">
                    <div className="text-[10px] text-text-secondary">
                        {new Date(solve.date).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                    </div>

                    <div
                        onClick={handleCopy}
                        className={`text-[11px] font-mono break-all leading-normal p-2 rounded cursor-pointer transition-colors
                            ${isCopied ? 'text-green-500 bg-green-500/10' : 'bg-zinc-100 text-zinc-900 border border-zinc-200 dark:border-transparent dark:bg-black/20 dark:text-text-secondary/70 hover:bg-zinc-200 dark:hover:bg-black/30'}`}
                        title="Click to copy"
                    >
                        {isCopied ? 'Copied to clipboard!' : solve.scramble}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => onPenalty(solve.id, '+2', solve.penalty, e)}
                                className={`px-2 py-1 text-xs rounded border border-border/50 hover:bg-bg-tertiary transition-colors ${solve.penalty === '+2' ? 'bg-orange-500/10 text-orange-500 border-orange-500/50' : 'text-text-secondary'}`}
                            >
                                +2
                            </button>
                            <button
                                onClick={(e) => onPenalty(solve.id, 'DNF', solve.penalty, e)}
                                className={`px-2 py-1 text-xs rounded border border-border/50 hover:bg-bg-tertiary transition-colors ${solve.penalty === 'DNF' ? 'bg-red-500/10 text-red-500 border-red-500/50' : 'text-text-secondary'}`}
                            >
                                DNF
                            </button>
                        </div>

                        <button
                            onClick={(e) => onDelete(solve.id, e)}
                            className="p-1.5 text-text-secondary hover:text-red-500 rounded hover:bg-bg-tertiary transition-colors"
                            title="Delete Solve"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
