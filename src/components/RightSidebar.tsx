import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useConfirm } from '../contexts/ConfirmationContext';
import { Trash2, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useState, useMemo } from 'react';
import { calculateBestAverage, calculateBestSingle, formatTime, calculateAverage } from '../utils/calculations';

interface RightSidebarProps {
    onToggleCollapse?: () => void;
    collapsed?: boolean;
}

type StatsMode = 'best' | 'session';

export default function RightSidebar({ onToggleCollapse, collapsed }: RightSidebarProps) {
    const { solves: allSolves, updateSolve, deleteSolve, isPrivateMode } = useSolves();
    const { user } = useAuth();
    const { currentSessionId, startNewSession } = useSession();
    const { confirm: confirmAction } = useConfirm();

    // -- Derived State --
    // "Local Experience" (Private Mode or Signed Out) vs "Cloud Experience" (Signed In & Online)
    const isLocalExperience = !user || isPrivateMode;

    // Filter Solves
    const displaySolves = useMemo(() => {
        if (isLocalExperience) {
            return allSolves;
        } else {
            return allSolves.filter(s => s.userId === user?.uid);
        }
    }, [allSolves, isLocalExperience, user]);

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
    const [statsMode, setStatsMode] = useState<StatsMode>('session');

    const currentSessionSolves = useMemo(() => {
        if (!currentSessionId) return [];
        return displaySolves.filter(s => s.sessionId === currentSessionId);
    }, [displaySolves, currentSessionId]);

    const stats = useMemo(() => {
        const activeSolves = currentSessionSolves;
        const totalSolves = displaySolves; // For "Best"

        const cs = (size: number) => calculateAverage(activeSolves, size);
        const bs = (size: number) => calculateBestAverage(totalSolves, size);

        return {
            current: {
                single: calculateAverage(activeSolves, 1),
                ao5: cs(5),
                ao12: cs(12),
                ao100: cs(100),
                ao1000: totalSolves.length >= 1000 ? cs(1000) : null
            },
            best: {
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
        if (await confirmAction('Delete this solve?')) {
            deleteSolve(id);
        }
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
            <div className="h-full flex flex-col items-center py-4 bg-bg-secondary border-l border-border transition-all duration-300 w-[50px]">
                <button
                    onClick={onToggleCollapse}
                    className="mt-auto p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-bg-hover transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            </div>
        );
    }

    return (
        <aside className="h-full bg-bg-secondary w-full select-none flex flex-col text-text-secondary text-sm overflow-hidden min-w-0 border-l border-border font-sans relative">

            {/* Header Area (Stats) */}
            <div className="flex flex-col border-b border-border bg-bg-secondary sticky top-0 z-10">
                {/* Stats Table */}
                <div className="grid grid-cols-3 gap-y-1 gap-x-2 text-center text-xs p-2">
                    <div className="col-span-1"></div>
                    <div className="col-span-1 font-semibold text-accent border-b border-transparent pb-1">Current</div>

                    {/* Toggle Header */}
                    <div
                        className="col-span-1 font-semibold text-text-primary border-b border-border/50 pb-1 cursor-pointer hover:bg-white/5 transition-colors select-none rounded-t flex items-center justify-center gap-1"
                        onClick={() => setStatsMode(prev => prev === 'best' ? 'session' : 'best')}
                    >
                        {statsMode === 'best' ? 'Best' : 'Session'}
                    </div>

                    <StatItem label="Single" current={stats.current.single} best={stats.best.single} show={true} statsMode={statsMode} />
                    <StatItem label="mo3" current={null} best={null} show={false} statsMode={statsMode} />
                    <StatItem label="ao5" current={stats.current.ao5} best={stats.best.ao5} show={true} statsMode={statsMode} />
                    <StatItem label="ao12" current={stats.current.ao12} best={stats.best.ao12} show={true} statsMode={statsMode} />
                    <StatItem label="ao100" current={stats.current.ao100} best={stats.best.ao100} show={true} statsMode={statsMode} />
                </div>
            </div>

            {/* Solve List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col">
                    {paginatedSolves.map((solve, index) => {
                        const prevSolve = paginatedSolves[index + 1];
                        const showDivider = prevSolve && (
                            (new Date(solve.date).getTime() - new Date(prevSolve.date).getTime() > 1000 * 60 * 60) || // 60 min gap
                            (solve.sessionId !== prevSolve.sessionId)
                        );

                        let sessionIndex = allSolves.length - index;
                        if (solve.sessionId) {
                            const solvesInSession = allSolves.filter(s => s.sessionId === solve.sessionId);
                            const indexInSession = solvesInSession.findIndex(s => s.id === solve.id);
                            if (indexInSession !== -1) {
                                sessionIndex = solvesInSession.length - indexInSession;
                            }
                        }

                        return (
                            <div key={solve.id}>
                                {showDivider && (
                                    <div className="py-2 flex items-center justify-center relative">
                                        <div className="text-[10px] bg-transparent text-text-secondary/40 font-mono z-10 px-2">
                                            {new Date(prevSolve.date).toLocaleString(undefined, {
                                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                            })}
                                        </div>
                                        <div className="w-full h-px border-t border-dashed border-border/30 absolute z-[-1]" />
                                    </div>
                                )}
                                <SolveItem
                                    solve={solve}
                                    index={sessionIndex}
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
                        {!user && !isPrivateMode && <span className="text-xs opacity-50">Sign in to sync.</span>}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border bg-bg-secondary flex justify-between items-center text-xs">
                <button
                    onClick={onToggleCollapse}
                    className="p-2 text-text-secondary hover:text-text-primary rounded-md hover:bg-bg-hover transition-colors"
                    title="Collapse sidebar"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>

                {isPrivateMode && (
                    <div className="flex items-center gap-2 text-text-secondary px-3 py-1.5 bg-bg-tertiary rounded-md border border-border/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Private Session
                    </div>
                )}
            </div>

        </aside>
    );
}

// -- Sub-Components --

const StatItem = ({ label, current, best, show, statsMode }: { label: string, current: any, best: any, show: boolean, statsMode: StatsMode }) => {
    if (!show) return null;
    return (
        <>
            <div className="text-left pl-1 font-medium text-text-secondary py-1">{label}</div>
            <div className="font-mono text-text-primary py-1">{formatTime(current)}</div>
            <div className={`font-mono py-1 ${statsMode === 'session' ? 'text-accent' : 'text-text-primary'}`}>
                {formatTime(statsMode === 'session' ? current : best)}
            </div>
        </>
    );
};

interface SolveItemProps {
    solve: Solve;
    index: number;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onPenalty: (id: string, type: '+2' | 'DNF', currentPenalty: string, e: React.MouseEvent) => void;
    onCopy: (scramble: string, e: React.MouseEvent) => void;
}

const SolveItem = ({ solve, index, onDelete, onPenalty, onCopy }: SolveItemProps) => {
    const formatTimeDisplay = (solve: Solve) => {
        if (solve.penalty === 'DNF' || solve.inspectionPenalty === 'DNF') return 'DNF';
        let tVal = solve.time;
        if (solve.penalty === '+2') tVal += 2000;
        if (solve.inspectionPenalty === '+2') tVal += 2000;
        let tStr = (tVal / 1000).toFixed(2);
        let plusCount = 0;
        if (solve.penalty === '+2') plusCount++;
        if (solve.inspectionPenalty === '+2') plusCount++;
        if (plusCount === 1) tStr += '+';
        if (plusCount === 2) tStr += '++';
        return tStr;
    };

    return (
        <div className="group flex items-center justify-between px-4 py-2 hover:bg-bg-hover/50 transition-colors border-l-2 border-transparent hover:border-accent cursor-pointer relative text-sm">
            <div className="flex items-center gap-3 min-w-0">
                <span className="text-text-secondary/40 font-mono w-6 text-right text-[10px]">{index}.</span>
                <span className={`font-mono font-medium ${solve.penalty === 'DNF' ? 'text-red-500' : 'text-text-primary'}`}>
                    {formatTimeDisplay(solve)}
                </span>
                {/* Daily Badge or Tag */}
                {solve.daily && (
                    <span
                        className={`text-[9px] px-1 rounded font-bold uppercase
                        ${solve.daily.includes('daily') ? 'bg-green-500/20 text-green-500' :
                                solve.daily.includes('weekly') ? 'bg-blue-500/20 text-blue-500' :
                                    'bg-accent/20 text-accent'}
                        `}
                    >
                        {solve.daily.includes('daily') ? 'D' : solve.daily.includes('weekly') ? 'W' : 'S'}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => onPenalty(solve.id, '+2', solve.penalty, e)}
                    className={`px-1.5 py-0.5 text-[10px] rounded hover:bg-bg-tertiary ${solve.penalty === '+2' ? 'text-orange-500 font-bold' : 'text-text-secondary'}`}
                >
                    +2
                </button>
                <button
                    onClick={(e) => onPenalty(solve.id, 'DNF', solve.penalty, e)}
                    className={`px-1.5 py-0.5 text-[10px] rounded hover:bg-bg-tertiary ${solve.penalty === 'DNF' ? 'text-red-500 font-bold' : 'text-text-secondary'}`}
                >
                    DNF
                </button>
                <button
                    onClick={(e) => onCopy(solve.scramble, e)}
                    className="p-1.5 text-text-secondary hover:text-text-primary rounded hover:bg-bg-tertiary"
                    title="Copy Scramble"
                >
                    <Copy className="w-3 h-3" />
                </button>
                <button
                    onClick={(e) => onDelete(solve.id, e)}
                    className="p-1.5 text-text-secondary hover:text-red-500 rounded hover:bg-bg-tertiary"
                    title="Delete Solve"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
};
