import { useSolves, type Solve } from '../contexts/SolvesContext';
import { Trash2, ChevronRight, ChevronLeft, Menu } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface RightSidebarProps {
    onToggleCollapse?: () => void;
    collapsed?: boolean;
}

type View = 'list' | 'stats';

export default function RightSidebar({ onToggleCollapse, collapsed }: RightSidebarProps) {
    const { solves, stats, updateSolve, deleteSolve, clearSolves } = useSolves();
    const [expandedSolveId, setExpandedSolveId] = useState<string | null>(null);
    const [view, setView] = useState<View>(() => {
        return (localStorage.getItem('cutter-cubing-sidebar-view') as View) || 'list';
    });

    useEffect(() => {
        localStorage.setItem('cutter-cubing-sidebar-view', view);
    }, [view]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const toggleExpand = (id: string) => {
        setExpandedSolveId(prev => (prev === id ? null : id));
    };

    const handleSolveClick = (id: string) => {
        if (collapsed && onToggleCollapse) {
            onToggleCollapse();
            setExpandedSolveId(id); // Expand this solve once sidebar opens
        } else {
            toggleExpand(id);
        }
    };

    const formatTimeDisplay = (solve: Solve) => {
        if (solve.penalty === 'DNF' || solve.inspectionPenalty === 'DNF') return 'DNF';

        let tVal = solve.time;
        if (solve.penalty === '+2') tVal += 2000;
        if (solve.inspectionPenalty === '+2') tVal += 2000;

        let tStr = (tVal / 1000).toFixed(2);

        // Suffix logic
        let plusCount = 0;
        if (solve.penalty === '+2') plusCount++;
        if (solve.inspectionPenalty === '+2') plusCount++;

        if (plusCount === 1) tStr += '+';
        if (plusCount === 2) tStr += '++';

        return tStr;
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    };

    const formatStat = (val: number | 'DNF' | null) => {
        if (val === null) return '-';
        if (val === 'DNF') return 'DNF';
        return (val / 1000).toFixed(2);
    };

    const SolvesList = () => (
        <>
            {solves.length === 0 ? (
                <div className="p-4 text-center text-text-secondary/50 italic">
                    No solves yet.
                </div>
            ) : (
                <div className="space-y-1">
                    {solves.map((solve, index) => {
                        const isDnf = solve.penalty === 'DNF' || solve.inspectionPenalty === 'DNF';
                        const wasLateStart = solve.inspectionTime !== undefined && solve.inspectionTime <= 0;
                        const defaultLatePenalty = (solve.inspectionTime !== undefined && solve.inspectionTime < -2) ? 'DNF' : '+2';

                        return (
                            <div
                                key={solve.id}
                                className={`rounded-md transition-all border ${expandedSolveId === solve.id ? 'bg-bg-primary border-border ring-1 ring-border shadow-sm' : 'hover:bg-bg-primary border-transparent hover:border-border'}`}
                            >
                                {/* Summary Line */}
                                <div
                                    onClick={() => toggleExpand(solve.id)}
                                    className="px-3 py-2 cursor-pointer flex justify-between items-center group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-text-secondary/30 w-6 text-right">
                                            {solves.length - index}
                                        </span>
                                        <span className={`font-mono text-lg font-medium ${isDnf ? 'text-red-400' : 'text-text-primary'}`}>
                                            {formatTimeDisplay(solve)}
                                        </span>
                                    </div>
                                    <span className="text-xs text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                                        {expandedSolveId === solve.id ? 'Hide' : 'Edit'}
                                    </span>
                                </div>

                                {/* Expanded Details */}
                                {expandedSolveId === solve.id && (
                                    <div className="px-3 pb-3 pt-0 border-t border-border/50 mt-1">
                                        <div
                                            onClick={() => navigator.clipboard.writeText(solve.scramble)}
                                            className="mt-2 text-xs font-mono text-text-secondary break-words bg-bg-secondary/50 p-2 rounded leading-relaxed cursor-pointer hover:text-text-primary transition-colors hover:bg-bg-primary/50"
                                            title="Click to copy scramble"
                                        >
                                            {solve.scramble}
                                        </div>
                                        <div className="mt-2 text-[10px] text-text-secondary/50 flex justify-end">
                                            {formatDate(solve.date)}
                                        </div>

                                        <div className="mt-3 flex gap-2 justify-between items-end flex-wrap">
                                            {/* Left: Late Start Actions */}
                                            <div>
                                                {wasLateStart && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateSolve(solve.id, {
                                                                inspectionPenalty: solve.inspectionPenalty === 'none' ? defaultLatePenalty : 'none'
                                                            });
                                                        }}
                                                        className={`px-2 py-1 rounded text-xs border ${solve.inspectionPenalty !== 'none'
                                                            ? (solve.inspectionPenalty === 'DNF' ? 'bg-red-500/20 text-red-500 border-red-500/50' : 'bg-orange-500/20 text-orange-500 border-orange-500/50')
                                                            : 'bg-bg-secondary border-border text-text-secondary/50 hover:border-text-secondary'
                                                            }`}
                                                        title="Toggle Late Start Penalty"
                                                    >
                                                        Late
                                                    </button>
                                                )}
                                            </div>

                                            {/* Right: Manual Actions */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        updateSolve(solve.id, { penalty: solve.penalty === '+2' ? 'none' : '+2' });
                                                        setExpandedSolveId(null);
                                                    }}
                                                    className={`px-2 py-1 rounded text-xs border ${solve.penalty === '+2' ? 'bg-accent/20 text-accent border-accent/50' : 'bg-bg-secondary border-border hover:border-accent/50'}`}
                                                >
                                                    +2
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        updateSolve(solve.id, { penalty: solve.penalty === 'DNF' ? 'none' : 'DNF' });
                                                        setExpandedSolveId(null);
                                                    }}
                                                    className={`px-2 py-1 rounded text-xs border ${solve.penalty === 'DNF' ? 'bg-red-500/20 text-red-500 border-red-500/50' : 'bg-bg-secondary border-border hover:border-red-500/50'}`}
                                                >
                                                    DNF
                                                </button>
                                                <button
                                                    onClick={() => deleteSolve(solve.id)}
                                                    className="px-2 py-1 rounded text-xs border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}


                </div>
            )}
        </>
    );

    // Collapsed View (Icons only)
    if (collapsed) {
        return (
            <aside className="h-full bg-bg-secondary w-full select-none flex flex-col text-text-secondary text-sm overflow-hidden items-center pt-2 border-l border-border min-w-[50px]">
                <div className="flex-1 overflow-y-auto custom-scrollbar w-full flex flex-col items-center gap-1 p-1">
                    {solves.map((solve) => (
                        <div
                            key={solve.id}
                            onClick={() => handleSolveClick(solve.id)}
                            className={`w-3 h-3 rounded-sm cursor-pointer hover:bg-fg-primary transition-colors ${(solve.penalty === 'DNF' || solve.inspectionPenalty === 'DNF') ? 'bg-red-400/50' : 'bg-text-secondary/30'
                                }`}
                            title={formatTimeDisplay(solve)}
                        />
                    ))}
                </div>

                <div className="p-2 border-t border-border w-full flex justify-center">
                    {onToggleCollapse && (
                        <button onClick={onToggleCollapse} className="p-1 hover:bg-bg-primary rounded text-text-secondary hover:text-text-primary transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </aside>
        );
    }

    return (
        <aside className="h-full bg-bg-secondary w-full select-none flex flex-col text-text-secondary text-sm overflow-hidden min-w-0 border-l border-border font-sans relative">
            {/* Header / Hamburger */}
            <div className="px-4 py-3 border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between h-[57px]">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`p-1 transition-colors rounded ${isMenuOpen ? 'bg-bg-primary text-text-primary' : 'hover:text-text-primary hover:bg-bg-primary text-text-secondary'}`}
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                    <h3 className="font-semibold text-text-primary whitespace-nowrap">
                        {view === 'list' ? 'Local Solves' : 'Statistics'}
                    </h3>
                </div>
            </div>

            {/* Menu Overlay */}
            {isMenuOpen && (
                <div
                    ref={menuRef}
                    className="absolute top-[57px] left-2 bg-bg-secondary border border-border rounded-md shadow-lg z-20 w-48 flex flex-col p-1"
                >
                    <button
                        onClick={() => { setView('list'); setIsMenuOpen(false); }}
                        className={`text-left px-3 py-2 rounded-md transition-colors text-xs ${view === 'list' ? 'bg-bg-primary text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'}`}
                    >
                        Local Solves
                    </button>
                    <button
                        onClick={() => { setView('stats'); setIsMenuOpen(false); }}
                        className={`text-left px-3 py-2 rounded-md transition-colors text-xs ${view === 'stats' ? 'bg-bg-primary text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'}`}
                    >
                        Statistics
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 relative">
                {view === 'stats' && (
                    <div className="flex flex-col gap-2 p-2 mb-2">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="col-span-1 font-semibold text-text-secondary text-left pl-1"></div>
                            <div className="col-span-1 font-semibold text-accent">Current</div>
                            <div className="col-span-1 font-semibold text-text-primary">Best</div>

                            <div className="text-left pl-1 font-medium text-text-secondary">Single</div>
                            <div className="font-mono text-text-primary">{formatStat(stats.current.single)}</div>
                            <div className="font-mono text-text-primary">{formatStat(stats.best.single)}</div>

                            <div className="text-left pl-1 font-medium text-text-secondary">Ao5</div>
                            <div className="font-mono text-text-primary">{formatStat(stats.current.ao5)}</div>
                            <div className="font-mono text-text-primary">{formatStat(stats.best.ao5)}</div>

                            <div className="text-left pl-1 font-medium text-text-secondary">Ao12</div>
                            <div className="font-mono text-text-primary">{formatStat(stats.current.ao12)}</div>
                            <div className="font-mono text-text-primary">{formatStat(stats.best.ao12)}</div>

                            <div className="text-left pl-1 font-medium text-text-secondary">Ao100</div>
                            <div className="font-mono text-text-primary">{formatStat(stats.current.ao100)}</div>
                            <div className="font-mono text-text-primary">{formatStat(stats.best.ao100)}</div>
                        </div>

                        <div className="border-t border-border/50 my-1" />

                    </div>
                )}

                {/* List shown in both views */}
                <SolvesList />
            </div>

            {/* Footer: Clear Buttons & Collapse Toggle - Matches LeftSidebar Style */}
            <div className="p-2 border-t border-border flex flex-col gap-2 bg-bg-secondary">
                {/* Clear Buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (confirm('Clear all non-best solves from local history?')) clearSolves(true);
                        }}
                        className="flex-1 p-2 rounded-md bg-bg-hover hover:bg-bg-primary text-text-secondary hover:text-text-primary transition-colors text-xs font-medium border border-border/50 shadow-sm"
                        title="Clear Safe (Keeps Bests)"
                    >
                        Clear Safe
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('PERMANENTLY clear ALL local solves? This cannot be undone.')) clearSolves(false);
                        }}
                        className="flex-1 p-2 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-600 transition-colors text-xs font-medium border border-red-500/20"
                        title="Clear All Solves"
                    >
                        Clear All
                    </button>
                </div>

                {/* Collapse Toggle */}
                {onToggleCollapse && (
                    <button
                        onClick={onToggleCollapse}
                        className="w-full flex items-center justify-center p-2 rounded-md hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
                        title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {collapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                )}
            </div>
        </aside>
    );
}
