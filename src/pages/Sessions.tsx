import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useSolves } from '../contexts/SolvesContext';
import { useConfirm } from '../contexts/ConfirmationContext';
import { calculateBestAverage, calculateBestSingle } from '../utils/calculations';
import Table from '../components/Table';
import { Calendar, Trash, Merge, X, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';

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
}

type SortField = 'date' | 'end' | 'duration' | 'solveTime' | 'solves' | 'bestSingle' | 'bestAo5' | 'bestAo12' | 'bestAo100';
type SortDirection = 'asc' | 'desc';

export default function Sessions() {
    const { user } = useAuth();
    const { currentSessionId, setCurrentSessionId } = useSession();
    const { solves } = useSolves();
    const { confirm: confirmAction } = useConfirm();
    const [sessions, setSessions] = useState<SessionDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Sorting
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Fetch Sessions
    const fetchSessions = async () => {
        if (!user) return;
        setLoading(true);
        try {
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

    // Filtering & Enriching
    const enrichedSessions = useMemo(() => {
        const result: EnrichedSession[] = sessions.map(session => {
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

            return {
                ...session,
                stats: { bestSingle, bestAo5, bestAo12, bestAo100 },
                durations: { sessionDuration, totalSolveTime }
            };
        });
        return result;
    }, [sessions, solves]);

    const filteredAndSortedSessions = useMemo(() => {
        let result = [...enrichedSessions];

        // Date Filter
        if (startDate) {
            const start = new Date(startDate).getTime();
            result = result.filter(s => new Date(s.startedAt).getTime() >= start);
        }
        if (endDate) {
            const end = new Date(endDate).getTime() + 86400000; // End of day
            result = result.filter(s => new Date(s.startedAt).getTime() < end);
        }

        // Sort
        result.sort((a, b) => {
            let valA: number = 0;
            let valB: number = 0;

            const getVal = (v: number | 'DNF' | null) => {
                if (v === null) return Infinity;
                if (v === 'DNF') return 999999999;
                return v;
            }

            switch (sortField) {
                case 'date':
                    valA = new Date(a.startedAt).getTime();
                    valB = new Date(b.startedAt).getTime();
                    break;
                case 'end':
                    valA = new Date(a.lastActiveAt).getTime();
                    valB = new Date(b.lastActiveAt).getTime();
                    break;
                case 'duration':
                    valA = a.durations.sessionDuration;
                    valB = b.durations.sessionDuration;
                    break;
                case 'solves':
                    valA = a.solveCount;
                    valB = b.solveCount;
                    break;
                case 'bestSingle':
                    valA = getVal(a.stats.bestSingle);
                    valB = getVal(b.stats.bestSingle);
                    break;
                case 'bestAo5':
                    valA = getVal(a.stats.bestAo5);
                    valB = getVal(b.stats.bestAo5);
                    break;
                case 'bestAo12':
                    valA = getVal(a.stats.bestAo12);
                    valB = getVal(b.stats.bestAo12);
                    break;
                case 'bestAo100':
                    valA = getVal(a.stats.bestAo100);
                    valB = getVal(b.stats.bestAo100);
                    break;
            }

            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });

        return result;
    }, [enrichedSessions, startDate, endDate, sortField, sortDirection]);

    // Selection Handlers
    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredAndSortedSessions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAndSortedSessions.map(s => s.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (!await confirmAction(`Delete ${selectedIds.size} sessions? This cannot be undone.`)) return;
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, 'sessions', id));
            });
            await batch.commit();
            setSelectedIds(new Set());
            fetchSessions();
        } catch (e) {
            console.error("Error deleting sessions", e);
        }
    };

    const handleMergeSelected = async () => {
        if (selectedIds.size < 2) return;
        if (!user) return;

        const count = sessions.filter(s => selectedIds.has(s.id)).reduce((acc, s) => acc + (s.solveCount || 0), 0);
        if (!await confirmAction(`Merge ${selectedIds.size} sessions (${count} solves) into a new combined session?`)) return;

        setLoading(true);
        try {
            const selected = sessions.filter(s => selectedIds.has(s.id));
            // Sort by start time
            selected.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

            const newStartedAt = selected[0].startedAt;
            const newLastActiveAt = selected.reduce((prev, curr) => {
                return new Date(curr.lastActiveAt).getTime() > new Date(prev.lastActiveAt).getTime() ? curr : prev;
            }).lastActiveAt;

            // 1. Prepare New Session ID (don't write yet)
            const newSessionRef = doc(collection(db, 'sessions'));
            const newSessionData = {
                userId: user.uid,
                startedAt: newStartedAt,
                lastActiveAt: newLastActiveAt,
                solveCount: count
            };

            // 2. Gather All Operations
            // We need to fetch all solves to be moved.
            const solvesToMove: any[] = [];
            for (const oldSession of selected) {
                const q = query(collection(db, 'solves'), where('sessionId', '==', oldSession.id));
                const snap = await getDocs(q);
                snap.forEach(d => solvesToMove.push(d));
            }

            // Operations List:
            // - Set New Session
            // - Update all Solves
            // - Delete Old Sessions

            // We'll execute in chunks of 500 max.

            // Helper to commit a batch
            const commitBatch = async (ops: any[]) => {
                const batch = writeBatch(db);
                ops.forEach(op => {
                    if (op.type === 'set') batch.set(op.ref, op.data);
                    if (op.type === 'update') batch.update(op.ref, op.data);
                    if (op.type === 'delete') batch.delete(op.ref);
                });
                await batch.commit();
            };

            let ops: any[] = [];

            // Op 1: Create New Session
            ops.push({ type: 'set', ref: newSessionRef, data: newSessionData });

            // Ops 2: Update Solves (Move to new session)
            solvesToMove.forEach(solveDoc => {
                ops.push({ type: 'update', ref: solveDoc.ref, data: { sessionId: newSessionRef.id } });
            });

            // Ops 3: Delete Old Sessions
            selected.forEach(s => {
                ops.push({ type: 'delete', ref: doc(db, 'sessions', s.id) });
            });

            // Chunk and Commit
            const BATCH_SIZE = 450;
            for (let i = 0; i < ops.length; i += BATCH_SIZE) {
                const chunk = ops.slice(i, i + BATCH_SIZE);
                await commitBatch(chunk);
            }

            // 3. Update Context if we merged the current session
            if (selectedIds.has(currentSessionId || '')) {
                setCurrentSessionId(newSessionRef.id);
            }

            setSelectedIds(new Set());
            await fetchSessions(); // Refresh

        } catch (e) {
            console.error("Error merging sessions", e);
            alert("Failed to merge sessions. See console."); // Custom alert or toast better? Use confirm mechanism for alert? No, usage of alert is discouraged but quick here.
        } finally {
            setLoading(false);
        }
    };

    // UI Helpers
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // Default desc for stats
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <div className="w-3 h-3 opacity-0 group-hover:opacity-20 transition-opacity" />;
        return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
    }



    const getLocalYMD = (d: Date) => {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    const setDatePreset = (days: number | 'all') => {
        setEndDate('');
        if (days === 'all') {
            setStartDate('');
        } else {
            const d = new Date();
            d.setDate(d.getDate() - days);
            setStartDate(getLocalYMD(d));
        }
    }

    const isPresetActive = (days: number | 'all') => {
        if (days === 'all') return !startDate && !endDate;
        if (!startDate || endDate) return false;

        const d = new Date();
        d.setDate(d.getDate() - days);
        return startDate === getLocalYMD(d);
    }

    const columns = [
        {
            header: <button onClick={toggleAll} className="p-1 hover:text-accent"><Square className={`w-4 h-4 ${selectedIds.size === filteredAndSortedSessions.length && filteredAndSortedSessions.length > 0 ? 'hidden' : ''}`} /><CheckSquare className={`w-4 h-4 text-accent ${selectedIds.size === filteredAndSortedSessions.length && filteredAndSortedSessions.length > 0 ? '' : 'hidden'}`} /></button>,
            accessor: (row: EnrichedSession) => <button onClick={(e) => { e.stopPropagation(); toggleSelection(row.id); }} className="p-1 hover:text-accent"><Square className={`w-4 h-4 ${selectedIds.has(row.id) ? 'hidden' : ''}`} /><CheckSquare className={`w-4 h-4 text-accent ${selectedIds.has(row.id) ? '' : 'hidden'}`} /></button>,
            className: "w-[40px] text-center"
        },
        {
            header: <div className="flex items-center gap-1 cursor-pointer hover:text-text-primary whitespace-nowrap" onClick={() => handleSort('date')}>Start <SortIcon field="date" /></div>,
            accessor: (row: EnrichedSession) => {
                const d = new Date(row.startedAt);
                return (
                    <div className="flex flex-col text-sm whitespace-nowrap">
                        <span className="font-medium text-text-primary">{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <span className="text-xs text-text-secondary">{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}</span>
                    </div>
                );
            },
            className: "w-[100px]"
        },
        {
            header: <div className="flex items-center gap-1 cursor-pointer hover:text-text-primary whitespace-nowrap" onClick={() => handleSort('end')}>End <SortIcon field="end" /></div>,
            accessor: (row: EnrichedSession) => {
                const d = new Date(row.lastActiveAt);
                return (
                    <div className="flex flex-col text-sm whitespace-nowrap">
                        <span className="font-medium text-text-primary">{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <span className="text-xs text-text-secondary">{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}</span>
                    </div>
                );
            },
            className: "w-[100px]"
        },
        {
            header: <div className="flex items-center justify-center gap-1 cursor-pointer hover:text-text-primary whitespace-nowrap w-full" onClick={() => handleSort('solves')}>Solves <SortIcon field="solves" /></div>,
            accessor: (row: EnrichedSession) => <span className="font-bold text-sm block text-center">{row.solveCount}</span>,
            className: "w-[80px]"
        },
        {
            header: 'ID',
            accessor: (row: EnrichedSession) => <span className="font-mono text-xs opacity-50 block truncate" title={row.id}>...{row.id.slice(-4)}</span>,
            className: "w-full min-w-[100px]"
        }
    ];

    if (!user) {
        return <div className="p-8 text-center text-text-secondary">Please sign in to view sessions.</div>;
    }

    return (
        <div className="w-full h-full flex flex-col text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary flex items-center gap-3">
                <Calendar className="w-8 h-8 text-accent" /> Sessions
            </h2>

            {/* Clean Filter Bar - No Background */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-end">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Presets Segmented Control */}
                    <div className="flex bg-bg-secondary/30 rounded-md p-1 border border-border/50">
                        {(['all', 7, 30] as const).map(preset => (
                            <button
                                key={preset}
                                onClick={() => setDatePreset(preset as any)}
                                className={`px-3 py-1 text-xs font-medium rounded transition-all ${isPresetActive(preset === 'all' ? 'all' : preset)
                                    ? 'bg-accent text-bg-primary shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                                    }`}
                            >
                                {preset === 'all' ? 'All Time' : `${preset} Days`}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-border/50 hidden sm:block"></div>

                    {/* Date Inputs */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">After</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent border-b border-border text-sm py-0.5 px-1 focus:outline-none focus:border-accent text-text-primary w-32 sm:w-36"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Before</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent border-b border-border text-sm py-0.5 px-1 focus:outline-none focus:border-accent text-text-primary w-32 sm:w-36"
                            />
                        </div>
                    </div>
                </div>

                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in duration-200">
                        <span className="text-sm font-medium text-accent mr-2">{selectedIds.size} selected</span>
                        <button onClick={handleMergeSelected} disabled={selectedIds.size < 2} className="p-2 hover:bg-bg-hover rounded-md text-text-secondary hover:text-text-primary disabled:opacity-50" title="Merge"><Merge className="w-4 h-4" /></button>
                        <button onClick={handleDeleteSelected} className="p-2 hover:bg-red-500/10 rounded-md text-red-500" title="Delete"><Trash className="w-4 h-4" /></button>
                        <button onClick={() => setSelectedIds(new Set())} className="p-2 hover:bg-bg-hover rounded-md text-text-secondary" title="Clear Selection"><X className="w-4 h-4" /></button>
                    </div>
                )}
            </div>

            {/* Table Area - No Border/Background */}
            <div className="flex-1 overflow-x-auto min-h-0">
                {loading ? (
                    <div className="text-center py-8 text-text-secondary">Loading sessions...</div>
                ) : filteredAndSortedSessions.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary">No sessions found.</div>
                ) : (
                    <Table data={filteredAndSortedSessions} columns={columns} />
                )}
            </div>
        </div>
    );
}
