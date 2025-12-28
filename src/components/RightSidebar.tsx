import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useConfirm } from '../contexts/ConfirmationContext';
import { Trash2, ChevronLeft, ChevronRight, EyeOff } from 'lucide-react';
import { useState, useMemo } from 'react';
import { calculateBestAverage, calculateBestSingle, formatTime, calculateAverage } from '../utils/calculations';

interface RightSidebarProps {
    onToggleCollapse?: () => void;
    collapsed?: boolean;
}

type StatsMode = 'best' | 'session';

export default function RightSidebar({ onToggleCollapse, collapsed }: RightSidebarProps) {
    const { solves: allSolves, updateSolve, deleteSolve, isPrivateMode, togglePrivateMode } = useSolves();
    const { user } = useAuth();
    const { currentSessionId } = useSession();
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
        // Solves are already sorted Newest -> Oldest in Context
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
                    className="mt-auto w-full py-4 text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex justify-center"
                    title="Toggle Sidebar (])"
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
                <div className="grid grid-cols-3 gap-y-2 gap-x-2 text-center text-xs p-4">
                    <div className="col-span-1"></div>
                    <div className="col-span-1 font-semibold text-text-secondary border-b border-transparent pb-1">Current</div>

                    {/* Toggle Header */}
                    <div
                        className="col-span-1 font-semibold text-text-primary border border-border/50 pb-1 cursor-pointer hover:bg-white/5 transition-colors select-none rounded flex items-center justify-center gap-1"
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
                        // For dividers: we actually want to show the divider BEFORE the group if logic implies break.
                        // But here we iterate Newest -> Oldest.
                        // So if index+1 (older) is different session than current, current starts a NEW session block (visually above older).
                        // So we render header ABOVE current if it's the start of a block (relative to older).
                        // Wait, list is top-down. Top is newest.
                        // If solve is start of a session (vs older neighbour), header goes ABOVE solve.
                        // Logic: If NO newer solve (index 0) OR newer solve (index-1) belongs to different session/gap => Header.

                        const newerSolve = paginatedSolves[index - 1]; // Newer
                        const showHeader = !newerSolve || (
                            (new Date(newerSolve.date).getTime() - new Date(solve.date).getTime() > 1000 * 60 * 60) ||
                            (newerSolve.sessionId !== solve.sessionId)
                        );

                        // Numbering: Total - Index
                        // Assuming allSolves is complete list.
                        // If local experience, simple length - index.
                        // If filtering... we filtered `displaySolves`.
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
            <div className="border-t border-border bg-bg-secondary flex flex-col">
                {/* Private Mode Toggle (Ghost) */}
                <button
                    onClick={togglePrivateMode}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-medium transition-colors border-b border-border/10
                        ${isPrivateMode ? 'text-text-primary bg-bg-tertiary shadow-inner' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
                    title={isPrivateMode ? "Exit Private Mode" : "Enter Private Mode"}
                >
                    <EyeOff className={`w-3.5 h-3.5 ${isPrivateMode ? 'text-accent animate-pulse' : ''}`} />
                    {isPrivateMode ? 'Private Mode Active' : 'Private Mode'}
                </button>

                {/* Collapse Toggle */}
                <button
                    onClick={onToggleCollapse}
                    className="w-8 h-8 mx-auto flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors rounded-full"
                    title="Toggle Sidebar (])"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
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
            <div className={`font-mono py-1 ${statsMode === 'session' ? 'text-text-primary' : 'text-text-primary'}`}>
                {formatTime(statsMode === 'session' ? current : best)}
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

    // Special Scramble Logic
    let badge = null;
    if (solve.daily) {
        if (solve.daily.includes('daily')) badge = { text: 'D', color: 'text-green-500', bg: 'bg-green-500/10' };
        else if (solve.daily.includes('weekly')) badge = { text: 'W', color: 'text-blue-500', bg: 'bg-blue-500/10' };
        else if (solve.daily.includes('monthly')) badge = { text: 'M', color: 'text-purple-500', bg: 'bg-purple-500/10' };
        // Assuming yearly/hourly IDs follow pattern or fallback
        else if (solve.daily.includes('project_2025')) badge = { text: 'Y', color: 'text-yellow-500', bg: 'bg-yellow-500/10' }; // Example for yearly
        else if (solve.daily.includes('hour')) badge = { text: 'H', color: 'text-zinc-500', bg: 'bg-zinc-500/10' }; // Example for hourly
        else badge = { text: 'S', color: 'text-accent', bg: 'bg-accent/10' };
    }

    return (
        <div
            onClick={onToggle}
            className={`flex flex-col border-l-2 transition-colors cursor-pointer text-sm
                ${expanded ? 'bg-bg-hover/30 border-accent' : 'border-transparent hover:bg-bg-hover/30'}
            `}
        >
            {/* Top Row: # Time Badge */}
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-text-secondary/40 font-mono w-6 text-right text-[10px]">{number}</span>
                    <span className={`font-mono font-medium ${solve.penalty === 'DNF' ? 'text-red-500' : 'text-text-primary'}`}>
                        {formatTimeDisplay(solve)}
                    </span>
                    {badge && (
                        <span className={`text-[10px] w-4 h-4 flex items-center justify-center rounded font-bold ${badge.color} ${badge.bg}`}>
                            {badge.text}
                        </span>
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-4 pb-3 pt-1 flex flex-col gap-2 animate-in slide-in-from-top-1 duration-200">
                    {/* Date */}
                    <div className="text-[10px] text-text-secondary">
                        {new Date(solve.date).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                    </div>

                    {/* Scramble */}
                    <div
                        onClick={(e) => onCopy(solve.scramble, e)}
                        className="text-[11px] font-mono text-text-secondary/70 break-all leading-normal bg-black/20 p-2 rounded cursor-pointer hover:bg-black/30 hover:text-text-primary transition-colors"
                        title="Click to copy"
                    >
                        {solve.scramble}
                    </div>

                    {/* Actions */}
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
