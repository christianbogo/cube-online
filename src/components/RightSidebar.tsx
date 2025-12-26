import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useConfirm } from '../contexts/ConfirmationContext';
import { Trash2, ChevronRight, ChevronLeft, Menu, Lock } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { calculateBestAverage, calculateBestSingle, formatTime, calculateAverage } from '../utils/calculations';
import { deleteDoc, doc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface RightSidebarProps {
    onToggleCollapse?: () => void;
    collapsed?: boolean;
}

type View = 'list' | 'stats' | 'session_viewer';

type StatsMode = 'best' | 'session';

export default function RightSidebar({ onToggleCollapse, collapsed }: RightSidebarProps) {
    const { solves: allSolves, stats: globalStats, updateSolve, deleteSolve, clearSolves } = useSolves();
    const { user } = useAuth();
    const { currentSessionId, startNewSession, viewedSessionId, setViewedSessionId } = useSession();
    const { confirm: confirmAction } = useConfirm();

    // Filter solves to ONLY user's cloud solves (as per request)
    // Though SolvesContext adds userId locally too, this ensures we match the signed in user.
    const solves = useMemo(() => {
        if (!user) return allSolves;
        return allSolves.filter(s => s.userId === user.uid);
    }, [allSolves, user]);

    const [view, setView] = useState<View>(() => {
        const stored = localStorage.getItem('cutter-cubing-sidebar-view') as View;
        return stored || 'list';
    });

    const [statsMode, setStatsMode] = useState<StatsMode>('best'); // Restored toggle state

    const [expandedSolveId, setExpandedSolveId] = useState<string | null>(null);
    const [showNav, setShowNav] = useState(false);

    useEffect(() => {
        if (!user && view === 'stats') {
            setView('list');
        } else if (user && !localStorage.getItem('cutter-cubing-sidebar-view')) {
            setView('stats');
        }

        // Auto-switch to session viewer if viewedSessionId is set externally (e.g. from Sessions page)
        if (viewedSessionId && view !== 'session_viewer') {
            setView('session_viewer');
            setShowNav(false);
        }
    }, [user, view, viewedSessionId]);

    useEffect(() => {
        localStorage.setItem('cutter-cubing-sidebar-view', view);
    }, [view]);

    // Session Logic
    const currentSessionSolves = useMemo(() => {
        if (!currentSessionId) return [];
        return solves.filter(s => s.sessionId === currentSessionId);
    }, [solves, currentSessionId]);

    const sessionStartTime = useMemo(() => {
        if (currentSessionSolves.length > 0) {
            const sorted = [...currentSessionSolves].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            return new Date(sorted[0].date);
        }
        return new Date();
    }, [currentSessionSolves]);

    const sessionStats = useMemo(() => {
        return {
            single: calculateBestSingle(currentSessionSolves),
            ao5: calculateBestAverage(currentSessionSolves, 5),
            ao12: calculateBestAverage(currentSessionSolves, 12),
            ao100: calculateBestAverage(currentSessionSolves, 100),
        };
    }, [currentSessionSolves]);

    // Current Stats for active session (not best)
    const currentSessionStats = useMemo(() => {
        return {
            single: calculateAverage(currentSessionSolves, 1),
            ao5: calculateAverage(currentSessionSolves, 5),
            ao12: calculateAverage(currentSessionSolves, 12),
            ao100: calculateAverage(currentSessionSolves, 100),
        };
    }, [currentSessionSolves]);

    // Session Viewer Logic
    const [viewerSessionsList, setViewerSessionsList] = useState<{ id: string, startedAt: string, solveCount: number }[]>([]);
    const [viewerShowList, setViewerShowList] = useState(false);

    useEffect(() => {
        const fetchSessions = async () => {
            if (view !== 'session_viewer' || !user) return;
            try {
                const q = query(
                    collection(db, 'sessions'),
                    where('userId', '==', user.uid),
                    orderBy('startedAt', 'desc')
                );
                const snapshot = await getDocs(q);
                setViewerSessionsList(snapshot.docs.map(d => ({
                    id: d.id,
                    startedAt: d.data().startedAt,
                    solveCount: d.data().solveCount
                })));
            } catch (e) {
                console.error("Error fetching sessions list", e);
            }
        };
        fetchSessions();
    }, [view, user]);

    // Viewed Session Stats
    const viewedSessionSolves = useMemo(() => {
        if (!viewedSessionId) return [];
        return solves.filter(s => s.sessionId === viewedSessionId);
    }, [solves, viewedSessionId]);

    const viewedSessionStats = useMemo(() => {
        return {
            single: calculateBestSingle(viewedSessionSolves),
            ao5: calculateBestAverage(viewedSessionSolves, 5),
            ao12: calculateBestAverage(viewedSessionSolves, 12),
            ao100: calculateBestAverage(viewedSessionSolves, 100),
        };
    }, [viewedSessionSolves]);

    const viewedSessionStartTime = useMemo(() => {
        if (viewedSessionSolves.length > 0) {
            const sorted = [...viewedSessionSolves].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            return new Date(sorted[0].date);
        }
        return null;
    }, [viewedSessionSolves]);

    const displayedSolves = view === 'stats' ? currentSessionSolves : (view === 'session_viewer' ? viewedSessionSolves : solves);

    const toggleExpand = (id: string) => {
        setExpandedSolveId(prev => (prev === id ? null : id));
    };

    const handleSolveClick = (id: string) => {
        if (collapsed && onToggleCollapse) {
            onToggleCollapse();
            setExpandedSolveId(id);
        } else {
            toggleExpand(id);
        }
    };

    const handleDeleteSession = async () => {
        if (!currentSessionId || !user) return;
        if (await confirmAction("Are you sure you want to delete this session? This action cannot be undone.")) {
            try {
                // Delete session doc
                await deleteDoc(doc(db, 'sessions', currentSessionId));
                // We do NOT delete the solves here automatically as context doesn't support batch delete yet?
                // Actually, existing functionality implies session deletion usually keeps solves or handles it elsewhere?
                // Wait, in Sessions.tsx delete does NOT delete solves.
                // But usually user expects "Delete Session" to clear it.
                // For now, let's just delete the session doc and start new.
                // Solves might remain as orphans or 'no session'.
                // Ideally we should delete them too.
                // Or maybe just unlink them.
                // Given constraints, I'll stick to just deleting session doc + start new.
                await startNewSession(false);
            } catch (e) {
                console.error("Error deleting session", e);
                alert("Failed to delete session.");
            }
        }
    };

    const handleNewSession = async () => {
        if (await confirmAction("Start a new session?")) {
            await startNewSession(false);
        }
    };

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

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    };

    const formatStatValue = (val: number | 'DNF' | null) => {
        return formatTime(val);
    };

    const SolvesList = ({ data }: { data: Solve[] }) => (
        <>
            {data.length === 0 ? (
                <div className="p-4 text-center text-text-secondary/50 italic">
                    {view === 'stats' ? 'No solves in this session.' : 'No solves. Get solving!'}
                </div>
            ) : (
                <div className="space-y-1">
                    {data.map((solve, index) => {
                        const isDnf = solve.penalty === 'DNF' || solve.inspectionPenalty === 'DNF';
                        const wasLateStart = solve.inspectionTime !== undefined && solve.inspectionTime <= 0;
                        const defaultLatePenalty = (solve.inspectionTime !== undefined && solve.inspectionTime < -2) ? 'DNF' : '+2';
                        const displayIndex = data.length - index;

                        return (
                            <div
                                key={solve.id}
                                className={`rounded-md transition-all border ${expandedSolveId === solve.id ? 'bg-bg-primary border-border ring-1 ring-border shadow-sm' : 'hover:bg-bg-primary border-transparent hover:border-border'}`}
                            >
                                <div
                                    onClick={() => toggleExpand(solve.id)}
                                    className="px-3 py-2 cursor-pointer flex justify-between items-center group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-text-secondary/30 w-6 text-right">
                                            {displayIndex}
                                        </span>
                                        <span className={`font-mono text-lg font-medium ${isDnf ? 'text-red-400' : 'text-text-primary'}`}>
                                            {formatTimeDisplay(solve)}
                                        </span>
                                    </div>
                                    <span className="text-xs text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                                        {expandedSolveId === solve.id ? 'Hide' : 'Edit'}
                                    </span>
                                </div>

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
                                                    >
                                                        Late
                                                    </button>
                                                )}
                                            </div>
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

    if (collapsed) {
        return (
            <aside className="h-full bg-bg-secondary w-full select-none flex flex-col text-text-secondary text-sm overflow-hidden items-center pt-2 border-l border-border min-w-[50px]">
                <div className="flex-1 overflow-y-auto custom-scrollbar w-full flex flex-col items-center gap-1 p-1">
                    {solves.map((solve) => (
                        <div
                            key={solve.id}
                            onClick={() => handleSolveClick(solve.id)}
                            className={`w-3 h-3 rounded-sm cursor-pointer hover:bg-fg-primary transition-colors ${(solve.penalty === 'DNF' || solve.inspectionPenalty === 'DNF') ? 'bg-red-400/50' : 'bg-text-secondary/30'}`}
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

            <div className="px-4 py-3 border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between h-[57px]">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowNav(!showNav)}
                        className={`p-1 transition-colors rounded ${showNav ? 'bg-bg-primary text-text-primary' : 'hover:text-text-primary hover:bg-bg-primary text-text-secondary'}`}
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                    <h3 className="font-semibold text-text-primary whitespace-nowrap">
                        {showNav ? 'Menu' : (view === 'stats' ? 'Statistics' : (view === 'session_viewer' ? 'Session Viewer' : 'Local Solves'))}
                    </h3>
                </div>
            </div>

            {showNav ? (
                <div className="flex-1 flex flex-col p-2 gap-1 animate-in slide-in-from-left-4 duration-200">
                    <button
                        onClick={() => { setView('list'); setShowNav(false); }}
                        className={`text-left px-3 py-3 rounded-md transition-colors text-sm font-medium ${view === 'list' ? 'bg-bg-primary text-text-primary border border-border' : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/50'}`}
                    >
                        Local Solves
                    </button>

                    <div className="relative group">
                        <button
                            disabled={!user}
                            onClick={() => { if (user) { setView('stats'); setShowNav(false); } }}
                            className={`w-full text-left px-3 py-3 rounded-md transition-colors text-sm font-medium flex justify-between items-center ${!user ? 'opacity-50 cursor-not-allowed' :
                                view === 'stats' ? 'bg-bg-primary text-text-primary border border-border' : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/50'
                                }`}
                        >
                            Statistics
                            {!user && <Lock className="w-3 h-3" />}
                        </button>
                        {!user && (
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-40 p-2 bg-bg-primary border border-border rounded shadow-xl text-xs text-text-secondary z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                Sign in to access statistics & sessions.
                            </div>
                        )}
                    </div>
                </div>
            ) : view === 'session_viewer' ? (
                // Session Viewer Layout
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Sub-Nav for Session Selection */}
                    <div className="flex items-center gap-2 p-2 border-b border-border bg-bg-secondary/30">
                        <button
                            onClick={() => setViewerShowList(!viewerShowList)}
                            className={`p-1.5 rounded transition-colors ${viewerShowList ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'}`}
                            title="Select Session"
                        >
                            <Menu className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex-1 text-xs text-text-secondary truncate font-mono">
                            {viewedSessionId ? (viewedSessionStartTime ? viewedSessionStartTime.toLocaleDateString() : 'Empty Session') : 'Select a Session'}
                        </div>
                    </div>

                    <div className="flex-1 relative overflow-hidden flex flex-col">
                        {viewerShowList ? (
                            <div className="absolute inset-0 z-20 bg-bg-secondary flex flex-col overflow-y-auto custom-scrollbar p-2 gap-1 animate-in slide-in-from-left-2 duration-200">
                                {viewerSessionsList.length === 0 ? <div className="text-secondary text-center p-4">Loading sessions...</div> :
                                    viewerSessionsList.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => { setViewedSessionId(s.id); setViewerShowList(false); }}
                                            className={`text-left p-2 rounded text-xs flex justify-between items-center ${viewedSessionId === s.id ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-bg-primary hover:text-text-primary'}`}
                                        >
                                            <span>{new Date(s.startedAt).toLocaleDateString()} <span className="opacity-50 text-[10px]">{new Date(s.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></span>
                                            <span className="font-mono font-bold opacity-70">{s.solveCount}</span>
                                        </button>
                                    ))
                                }
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Stats for Viewed Session */}
                                {viewedSessionId && (
                                    <div className="flex flex-col gap-2 p-2 mb-2 animate-in fade-in duration-300 shrink-0">
                                        <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-center text-xs">
                                            <div className="col-span-1"></div>
                                            <div className="col-span-1 font-semibold text-accent border-b border-transparent pb-1">Stats</div>

                                            <div className="text-left pl-1 font-medium text-text-secondary py-1">Single</div>
                                            <div className="font-mono text-accent py-1">{formatStatValue(viewedSessionStats.single)}</div>

                                            <div className="text-left pl-1 font-medium text-text-secondary py-1 bg-bg-primary/30 rounded-l">Ao5</div>
                                            <div className="font-mono text-accent py-1 bg-bg-primary/30 rounded-r">{formatStatValue(viewedSessionStats.ao5)}</div>

                                            <div className="text-left pl-1 font-medium text-text-secondary py-1">Ao12</div>
                                            <div className="font-mono text-accent py-1">{formatStatValue(viewedSessionStats.ao12)}</div>

                                            <div className="text-left pl-1 font-medium text-text-secondary py-1 bg-bg-primary/30 rounded-l">Ao100</div>
                                            <div className="font-mono text-accent py-1 bg-bg-primary/30 rounded-r">{formatStatValue(viewedSessionStats.ao100)}</div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                    <SolvesList data={displayedSolves} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 relative flex flex-col">

                    {view === 'stats' && (
                        <div className="flex flex-col gap-2 p-2 mb-2 animate-in fade-in duration-300">

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-y-1 gap-x-2 text-center text-xs">
                                <div className="col-span-1"></div>
                                <div className="col-span-1 font-semibold text-accent border-b border-transparent pb-1">Current</div>

                                {/* Toggle Header */}
                                <div
                                    className="col-span-1 font-semibold text-text-primary border-b border-border/50 pb-1 cursor-pointer hover:bg-white/5 transition-colors select-none rounded-t"
                                    onClick={() => setStatsMode(prev => prev === 'best' ? 'session' : 'best')}
                                    title={`Switch to ${statsMode === 'best' ? 'Session' : 'Global'} Best`}
                                >
                                    {statsMode === 'best' ? 'Best' : 'Session'}
                                </div>

                                <div className="text-left pl-1 font-medium text-text-secondary py-1">Single</div>
                                <div className="font-mono text-text-primary py-1">{formatStatValue(currentSessionStats.single)}</div>
                                <div className={`font-mono py-1 ${statsMode === 'session' ? 'text-accent' : 'text-text-primary'}`}>
                                    {formatStatValue(statsMode === 'session' ? sessionStats.single : globalStats.best.single)}
                                </div>

                                <div className="text-left pl-1 font-medium text-text-secondary py-1 bg-bg-primary/30 rounded-l">Ao5</div>
                                <div className="font-mono text-text-primary py-1 bg-bg-primary/30">{formatStatValue(currentSessionStats.ao5)}</div>
                                <div className={`font-mono py-1 bg-bg-primary/30 rounded-r ${statsMode === 'session' ? 'text-accent' : 'text-text-primary'}`}>
                                    {formatStatValue(statsMode === 'session' ? sessionStats.ao5 : globalStats.best.ao5)}
                                </div>

                                <div className="text-left pl-1 font-medium text-text-secondary py-1">Ao12</div>
                                <div className="font-mono text-text-primary py-1">{formatStatValue(currentSessionStats.ao12)}</div>
                                <div className={`font-mono py-1 ${statsMode === 'session' ? 'text-accent' : 'text-text-primary'}`}>
                                    {formatStatValue(statsMode === 'session' ? sessionStats.ao12 : globalStats.best.ao12)}
                                </div>

                                <div className="text-left pl-1 font-medium text-text-secondary py-1 bg-bg-primary/30 rounded-l">Ao100</div>
                                <div className="font-mono text-text-primary py-1 bg-bg-primary/30">{formatStatValue(currentSessionStats.ao100)}</div>
                                <div className={`font-mono py-1 bg-bg-primary/30 rounded-r ${statsMode === 'session' ? 'text-accent' : 'text-text-primary'}`}>
                                    {formatStatValue(statsMode === 'session' ? sessionStats.ao100 : globalStats.best.ao100)}
                                </div>
                            </div>
                            <div className="border-t border-border/50 mt-1 mb-0.5" />

                            {/* Session Info (Tight spacing) */}
                            <div className="text-center text-xs text-text-secondary w-full mb-0.5 mt-0.5">
                                <span className="font-mono opacity-70">
                                    {sessionStartTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, {sessionStartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}
                                </span>
                            </div>
                        </div>
                    )}

                    <SolvesList data={displayedSolves} />
                </div>
            )}

            {/* Footer */}
            <div className="p-2 border-t border-border flex flex-col gap-2 bg-bg-secondary">
                {/* Footer Content depends on tab */}
                {view === 'list' ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => { if (await confirmAction('Clear all non-best solves from local history?')) clearSolves(true); }}
                            className="flex-1 p-2 rounded-md hover:bg-bg-primary text-text-secondary hover:text-text-primary transition-colors text-xs font-medium"
                            title="Clear Safe (Keeps Bests)"
                        >
                            Clear Safe
                        </button>
                        <button
                            onClick={async () => { if (await confirmAction('PERMANENTLY clear ALL local solves? This cannot be undone.')) clearSolves(false); }}
                            className="flex-1 p-2 rounded-md hover:bg-red-500/10 text-text-secondary hover:text-red-500 transition-colors text-xs font-medium"
                            title="Clear All Solves"
                        >
                            Clear All
                        </button>
                    </div>
                ) : view === 'session_viewer' ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setView('stats'); setViewedSessionId(null); }}
                            className="w-full p-2 rounded-md hover:bg-bg-primary text-text-secondary hover:text-text-primary transition-colors text-xs font-medium"
                            title="Back to Statistics"
                        >
                            Back to Current Session
                        </button>
                        {viewedSessionId && (
                            <button
                                onClick={async () => {
                                    if (viewedSessionId && user && await confirmAction("Are you sure you want to delete this session?")) {
                                        await deleteDoc(doc(db, 'sessions', viewedSessionId));
                                        await startNewSession(false); // Just to refresh state if needed, though mostly just need to clear viewed.
                                        setViewedSessionId(null);
                                        // Trigger refresh of list? 
                                        // The list should update on next fetch.
                                        // Simple hack: setView('stats') to exit.
                                        setView('stats');
                                    }
                                }}
                                className="p-2 rounded-md hover:bg-red-500/10 text-red-500/70 hover:text-red-500 transition-colors text-xs font-medium"
                                title="Delete This Session"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleNewSession}
                            className="flex-1 p-2 rounded-md hover:bg-bg-primary text-text-secondary hover:text-text-primary transition-colors text-xs font-medium"
                            title="Start New Session"
                        >
                            New Session
                        </button>
                        <button
                            onClick={handleDeleteSession}
                            className="flex-1 p-2 rounded-md hover:bg-red-500/10 text-text-secondary hover:text-red-500 transition-colors text-xs font-medium"
                            title="Delete Current Session"
                        >
                            Delete Session
                        </button>
                    </div>
                )}
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
