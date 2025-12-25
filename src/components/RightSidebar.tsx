import { useSolves, type Solve } from '../contexts/SolvesContext';
import { Trash2, ChevronRight, ChevronLeft, Menu } from 'lucide-react';
import { useState } from 'react';

interface RightSidebarProps {
    onToggleCollapse?: () => void;
    collapsed?: boolean;
}

type View = 'list' | 'menu';

export default function RightSidebar({ onToggleCollapse, collapsed }: RightSidebarProps) {
    const { solves, updateSolve, deleteSolve } = useSolves();
    const [expandedSolveId, setExpandedSolveId] = useState<string | null>(null);
    const [view, setView] = useState<View>('list'); // 'list' is default solve list, 'menu' for options

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
        let t = (solve.time / 1000).toFixed(2);
        if (solve.penalty === '+2') {
            t = ((solve.time + 2000) / 1000).toFixed(2) + '+';
        } else if (solve.penalty === 'DNF') {
            return 'DNF';
        }
        return t;
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    };

    // Collapsed View (Icons only)
    if (collapsed) {
        return (
            <aside className="h-full bg-bg-secondary w-full select-none flex flex-col text-text-secondary text-sm overflow-hidden items-center pt-2 border-l border-border min-w-[50px]">
                <div className="flex-1 overflow-y-auto custom-scrollbar w-full flex flex-col items-center gap-1 p-1">
                    {solves.map((solve) => (
                        <div
                            key={solve.id}
                            onClick={() => handleSolveClick(solve.id)}
                            className={`w-3 h-3 rounded-sm cursor-pointer hover:bg-fg-primary transition-colors ${solve.penalty === 'DNF' ? 'bg-red-400/50' : 'bg-text-secondary/30'}`}
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
        <aside className="h-full bg-bg-secondary w-full select-none flex flex-col text-text-secondary text-sm overflow-hidden min-w-0 border-l border-border font-sans">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-3 h-[57px]">
                <button
                    onClick={() => setView(view === 'list' ? 'menu' : 'list')}
                    className="p-1 hover:text-text-primary transition-colors hover:bg-bg-primary rounded"
                >
                    <Menu className="w-4 h-4" />
                </button>
                <h3 className="font-semibold text-text-primary whitespace-nowrap">
                    {view === 'list' ? 'Local Solves' : 'Options'}
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {view === 'menu' ? (
                    <div className="flex flex-col gap-1 p-2">
                        <button
                            onClick={() => setView('list')}
                            className="text-left px-4 py-3 rounded-md hover:bg-bg-primary text-text-primary transition-colors"
                        >
                            Local Solves
                        </button>
                        <button
                            className="text-left px-4 py-3 rounded-md hover:bg-bg-primary text-text-secondary hover:text-text-primary transition-colors opacity-50 cursor-not-allowed"
                            title="Coming soon"
                        >
                            Avg Current
                        </button>
                        <button
                            className="text-left px-4 py-3 rounded-md hover:bg-bg-primary text-text-secondary hover:text-text-primary transition-colors opacity-50 cursor-not-allowed"
                            title="Coming soon"
                        >
                            Avg Bests
                        </button>
                    </div>
                ) : (
                    // List View
                    solves.length === 0 ? (
                        <div className="p-4 text-center text-text-secondary/50 italic">
                            No solves yet.
                        </div>
                    ) : (
                        solves.map((solve, index) => (
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
                                            #{solves.length - index}
                                        </span>
                                        <span className={`font-mono text-lg font-medium ${solve.penalty === 'DNF' ? 'text-red-400' : 'text-text-primary'}`}>
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
                                        <div className="mt-2 text-xs font-mono text-text-secondary break-words bg-bg-secondary/50 p-2 rounded leading-relaxed">
                                            {solve.scramble}
                                        </div>
                                        <div className="mt-2 text-[10px] text-text-secondary/50 flex justify-end">
                                            {formatDate(solve.date)}
                                        </div>

                                        <div className="mt-3 flex gap-2 justify-end">
                                            <button
                                                onClick={() => updateSolve(solve.id, { penalty: solve.penalty === '+2' ? 'none' : '+2' })}
                                                className={`px-2 py-1 rounded text-xs border ${solve.penalty === '+2' ? 'bg-accent/20 text-accent border-accent/50' : 'bg-bg-secondary border-border hover:border-accent/50'}`}
                                            >
                                                +2
                                            </button>
                                            <button
                                                onClick={() => updateSolve(solve.id, { penalty: solve.penalty === 'DNF' ? 'none' : 'DNF' })}
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
                                )}
                            </div>
                        ))
                    )
                )}
            </div>

            {/* Collapse Toggle */}
            <div className="p-2 border-t border-border flex justify-start">
                {onToggleCollapse && (
                    <button onClick={onToggleCollapse} className="p-2 hover:bg-bg-primary rounded-md text-text-secondary hover:text-text-primary transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </div>
        </aside>
    );
}
