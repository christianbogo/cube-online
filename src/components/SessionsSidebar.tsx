import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useSolves } from '../contexts/SolvesContext';
import { useConfirm } from '../contexts/ConfirmationContext';
import { calculateBestAverage, calculateBestSingle, formatTime } from '../utils/calculations';
import { Trash2, ChevronLeft, ChevronRight, ChevronDown, CheckSquare, Square, Calendar } from 'lucide-react';

interface SessionDoc {
    id: string;
    startedAt: string;
    lastActiveAt: string;
    solveCount: number;
}

interface EnrichedSession extends SessionDoc {
    stats: {
        bestSingle: number | null;
        bestAo5: number | 'DNF' | null;
        bestAo12: number | 'DNF' | null;
        bestAo100: number | 'DNF' | null;
    };
    durations: {
        sessionDuration: number;
        totalSolveTime: number;
    };
    dailyString: string; // '4m2d...'
    scrambleType: string;
}

type StatColumn = 'daily' | 'single' | 'ao5' | 'ao12' | 'ao100' | 'scramble' | 'duration';

const COLUMN_OPTIONS: { value: StatColumn; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'single', label: 'Best' },
    { value: 'ao5', label: 'Ao5' },
    { value: 'ao12', label: 'Ao12' },
    { value: 'ao100', label: 'Ao100' },
    { value: 'scramble', label: 'Scramble' },
    { value: 'duration', label: 'Time' }, // Duration
];

export default function SessionsSidebar({ onToggleCollapse, collapsed }: { onToggleCollapse: () => void, collapsed: boolean }) {
    const { user } = useAuth();
    const { currentSessionId, setCurrentSessionId } = useSession(); // We might use this to highlight active?
    const { solves } = useSolves(); // Need all solves to calculate stats
    const { confirm: confirmAction } = useConfirm();

    const [sessions, setSessions] = useState<SessionDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [statColumn, setStatColumn] = useState<StatColumn>('daily');

    // Fetch Sessions
    const fetchSessions = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // "Double check the session logic, it seems to be missing some of my earlier sessions."
            // Ensure we are not limiting too aggressively.
            const q = query(
                collection(db, 'sessions'),
                where('userId', '==', user.uid),
                orderBy('startedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SessionDoc));
            setSessions(fetched);
        } catch (e) {
            console.error("Error fetching sessions", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, [user]);

    // Enrich Sessions
    const enrichedSessions = useMemo(() => {
        return sessions.map((session): EnrichedSession => {
            const sessionSolves = solves.filter(s => s.sessionId === session.id);

            // Calculate Stats
            const bestSingle = calculateBestSingle(sessionSolves);
            const bestAo5 = calculateBestAverage(sessionSolves, 5);
            const bestAo12 = calculateBestAverage(sessionSolves, 12);
            const bestAo100 = calculateBestAverage(sessionSolves, 100);

            // Times
            const start = new Date(session.startedAt).getTime();
            const end = new Date(session.lastActiveAt).getTime();
            const sessionDuration = Math.max(0, end - start);
            const totalSolveTime = sessionSolves.reduce((acc, s) => acc + s.time, 0);

            // Daily String Calculation
            let y = 0, m = 0, w = 0, d = 0, h = 0;
            sessionSolves.forEach(s => {
                if (s.daily) {
                    const id = s.daily.toLowerCase();
                    if (id.startsWith('y-') || id.includes('project')) y++;
                    else if (id.startsWith('m-') || id.includes('monthly')) m++;
                    else if (id.startsWith('w-') || id.includes('weekly')) w++;
                    else if (id.startsWith('d-') || id.includes('daily')) d++;
                    else if (id.startsWith('h-') || id.includes('hour')) h++;
                }
            });
            let dailyParts = [];
            if (y > 0) dailyParts.push(`${y}y`);
            if (m > 0) dailyParts.push(`${m}m`);
            if (w > 0) dailyParts.push(`${w}w`);
            if (d > 0) dailyParts.push(`${d}d`);
            if (h > 0) dailyParts.push(`${h}h`);
            const dailyString = dailyParts.join('') || '-';

            // Scramble Type (take majority or first)
            const scrambleType = sessionSolves[0]?.scrambleType || '333';

            return {
                ...session,
                stats: { bestSingle, bestAo5, bestAo12, bestAo100 },
                durations: { sessionDuration, totalSolveTime },
                dailyString,
                scrambleType
            };
        });
    }, [sessions, solves]);


    const handleDeleteSelected = async () => {
        if (!await confirmAction(`Delete ${selectedIds.size} sessions?`)) return;
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, 'sessions', id));
            });
            await batch.commit();
            setSelectedIds(new Set());
            fetchSessions();
        } catch (e) {
            console.error("Error deleting", e);
        }
    };

    const toggleSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const formatDuration = (ms: number) => {
        const secs = Math.floor(ms / 1000);
        const mins = Math.floor(secs / 60);
        const hrs = Math.floor(mins / 60);
        if (hrs > 0) return `${hrs}h ${mins % 60}m`;
        if (mins > 0) return `${mins}m`;
        return `${secs}s`;
    }

    if (collapsed) {
        return (
            <aside className="h-full bg-bg-secondary w-[50px] flex flex-col border-l border-border transition-all duration-300 items-center justify-between py-4">
                <div />
                <button onClick={onToggleCollapse} className="p-2 hover:bg-bg-hover rounded text-text-secondary"><ChevronLeft /></button>
            </aside>
        )
    }

    return (
        <aside className="h-full bg-bg-secondary w-full select-none flex flex-col text-sm overflow-hidden min-w-0 border-l border-border font-sans">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border/50 bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10">
                <span className="font-semibold text-text-primary flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent" /> Sessions
                </span>
                <div className="flex items-center gap-1">
                    {selectedIds.size > 0 && (
                        <button onClick={handleDeleteSelected} className="p-1 hover:bg-red-500/10 text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                    )}
                </div>
            </div>

            {/* List Header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-4 py-2 text-xs font-bold text-text-secondary border-b border-border/20 uppercase tracking-wider items-center">
                <div className="w-4"></div>
                <div className="cursor-pointer hover:text-text-primary">Start</div>
                <div className="cursor-div hover:text-text-primary text-center">Solves</div>

                {/* Dropdown for 3rd Column */}
                <div className="relative group min-w-[60px] text-right">
                    <select
                        value={statColumn}
                        onChange={(e) => setStatColumn(e.target.value as StatColumn)}
                        className="appearance-none bg-transparent hover:text-accent cursor-pointer focus:outline-none text-right w-full pr-3"
                    >
                        {COLUMN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {loading && <div className="p-4 text-center text-xs text-text-secondary">Loading...</div>}
                {!loading && enrichedSessions.map(session => (
                    <div
                        key={session.id}
                        className={`grid grid-cols-[auto_1fr_auto_auto] gap-2 px-4 py-3 border-b border-border/10 hover:bg-bg-hover/50 transition-colors cursor-pointer group
                            ${currentSessionId === session.id ? 'bg-accent/5 border-l-2 border-l-accent' : 'border-l-2 border-l-transparent'}
                            ${selectedIds.has(session.id) ? 'bg-accent/10' : ''}
                        `}
                        onClick={() => setCurrentSessionId(session.id)}
                    >
                        {/* Checkbox */}
                        <div onClick={(e) => toggleSelection(session.id, e)} className="flex items-center justify-center w-4 text-text-secondary hover:text-accent">
                            {selectedIds.has(session.id) ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4 opacity-20 group-hover:opacity-100" />}
                        </div>

                        {/* Start Date */}
                        <div className="flex flex-col min-w-0">
                            <span className="font-medium text-text-primary truncate">
                                {new Date(session.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-[10px] text-text-secondary truncate">
                                {new Date(session.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}
                            </span>
                        </div>

                        {/* Solves */}
                        <div className="flex items-center justify-center font-mono text-text-primary">
                            {session.solveCount}
                        </div>

                        {/* Dynamic Stat */}
                        <div className="flex items-center justify-end font-mono text-sm text-text-primary min-w-[60px]">
                            {statColumn === 'daily' && <span className="text-xs text-text-secondary">{session.dailyString}</span>}
                            {statColumn === 'single' && <span>{formatTime(session.stats.bestSingle)}</span>}
                            {statColumn === 'ao5' && <span>{formatTime(session.stats.bestAo5)}</span>}
                            {statColumn === 'ao12' && <span>{formatTime(session.stats.bestAo12)}</span>}
                            {statColumn === 'ao100' && <span>{formatTime(session.stats.bestAo100)}</span>}
                            {statColumn === 'scramble' && <span className="text-xs uppercase bg-bg-tertiary px-1.5 py-0.5 rounded text-text-secondary">{session.scrambleType}</span>}
                            {statColumn === 'duration' && <span className="text-xs text-text-secondary">{formatDuration(session.durations.sessionDuration)}</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer with Chevron */}
            <div className="p-2 border-t border-border/50 flex justify-end">
                <button onClick={onToggleCollapse} className="p-2 hover:bg-bg-hover rounded text-text-secondary">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </aside>
    );
}
