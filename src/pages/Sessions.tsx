import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import Table from '../components/Table';
import { Calendar, Search, Trash, Merge, X, CheckSquare, Square } from 'lucide-react';

interface SessionDoc {
    id: string;
    startedAt: string;
    lastActiveAt: string;
    solveCount: number;
}

type DateFilter = 'all' | '7days' | '30days';
type SortOrder = 'newest' | 'oldest' | 'most_solves';

export default function Sessions() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<SessionDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
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

    // Filtering & Sorting
    const filteredSessions = useMemo(() => {
        let result = [...sessions];

        // Search (ID or Date string match)
        if (searchTerm) {
            const lowerDate = searchTerm.toLowerCase();
            result = result.filter(s =>
                s.id.includes(searchTerm) ||
                new Date(s.startedAt).toLocaleDateString().toLowerCase().includes(lowerDate)
            );
        }

        // Date Filter
        const now = Date.now();
        if (dateFilter === '7days') {
            result = result.filter(s => (now - new Date(s.startedAt).getTime()) < 7 * 24 * 60 * 60 * 1000);
        } else if (dateFilter === '30days') {
            result = result.filter(s => (now - new Date(s.startedAt).getTime()) < 30 * 24 * 60 * 60 * 1000);
        }

        // Sort
        result.sort((a, b) => {
            if (sortOrder === 'newest') return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
            if (sortOrder === 'oldest') return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
            if (sortOrder === 'most_solves') return b.solveCount - a.solveCount;
            return 0;
        });

        return result;
    }, [sessions, searchTerm, dateFilter, sortOrder]);

    // Selection Handlers
    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredSessions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredSessions.map(s => s.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (!confirm(`Delete ${selectedIds.size} sessions? This cannot be undone.`)) return;

        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, 'sessions', id));
                // TODO: Also delete solves associated with this session? 
                // Ops check: Requirements didn't specify cascading delete of solves for session delete.
                // But usually yes. For now, just deleting session doc.
            });
            await batch.commit();
            setSelectedIds(new Set());
            fetchSessions(); // Refresh
        } catch (e) {
            console.error("Error deleting sessions", e);
        }
    };

    const handleMergeSelected = async () => {
        if (selectedIds.size < 2) return;
        if (!confirm(`Merge ${selectedIds.size} sessions into the oldest one?`)) return;

        // Logic: Find oldest session (Target). 
        // New lastActiveAt = Newest of the group.
        // SolveCount = Sum.

        const selected = sessions.filter(s => selectedIds.has(s.id));
        // Sort Ascending (Oldest first)
        selected.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

        const target = selected[0];
        const others = selected.slice(1);

        const totalSolves = selected.reduce((acc, s) => acc + (s.solveCount || 0), 0);

        // Find latest lastActiveAt
        const latestActive = selected.reduce((prev, curr) => {
            return new Date(curr.lastActiveAt).getTime() > new Date(prev.lastActiveAt).getTime() ? curr : prev;
        }).lastActiveAt;

        try {
            const batch = writeBatch(db);

            // Update target
            batch.update(doc(db, 'sessions', target.id), {
                solveCount: totalSolves,
                lastActiveAt: latestActive
            });

            // Delete others
            others.forEach(s => {
                batch.delete(doc(db, 'sessions', s.id));
            });

            await batch.commit();
            setSelectedIds(new Set());
            fetchSessions();
        } catch (e) {
            console.error("Error merging", e);
        }
    };

    // Columns
    const columns = [
        {
            header: (
                <div className="flex items-center">
                    <button onClick={toggleAll} className="hover:text-accent">
                        {filteredSessions.length > 0 && selectedIds.size === filteredSessions.length ? (
                            <CheckSquare className="w-4 h-4 text-accent" />
                        ) : (
                            <Square className="w-4 h-4" />
                        )}
                    </button>
                </div>
            ),
            accessor: (row: SessionDoc) => (
                <div className="flex items-center">
                    <button onClick={() => toggleSelection(row.id)} className="hover:text-accent">
                        {selectedIds.has(row.id) ? (
                            <CheckSquare className="w-4 h-4 text-accent" />
                        ) : (
                            <Square className="w-4 h-4" />
                        )}
                    </button>
                </div>
            ),
            className: "w-10"
        },
        {
            header: 'Date',
            accessor: (row: SessionDoc) => {
                const d = new Date(row.startedAt);
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ", " +
                    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
            }
        },
        {
            header: 'Last Active',
            accessor: (row: SessionDoc) => {
                const d = new Date(row.lastActiveAt);
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ", " +
                    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
            }
        },
        {
            header: 'Solves',
            accessor: (row: SessionDoc) => row.solveCount || 0
        },
        {
            header: 'ID',
            accessor: (row: SessionDoc) => <span className="font-mono text-xs opacity-50">{row.id.slice(0, 8)}...</span>
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

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-end md:items-center">

                {/* Search & Filter */}
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-accent transition-colors" />
                        <input
                            type="text"
                            placeholder="Search sessions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-bg-secondary/50 border border-border/50 rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-accent/50 w-full md:w-64 transition-all"
                        />
                    </div>
                </div>

                {/* Sort & Quick Filter */}
                <div className="flex gap-2">
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                        className="bg-bg-secondary/50 border border-border/50 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-accent/50 appearance-none cursor-pointer"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="most_solves">Most Solves</option>
                    </select>

                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                        className="bg-bg-secondary/50 border border-border/50 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-accent/50 appearance-none cursor-pointer"
                    >
                        <option value="all">All Time</option>
                        <option value="7days">Last 7 Days</option>
                        <option value="30days">Last 30 Days</option>
                    </select>
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-4 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                    <span className="text-sm font-medium text-accent px-2">
                        {selectedIds.size} selected
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={handleMergeSelected}
                            disabled={selectedIds.size < 2}
                            title={selectedIds.size < 2 ? "Select at least 2 to merge" : "Merge Selected"}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-bg-secondary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Merge className="w-4 h-4" /> Merge
                        </button>
                        <button
                            onClick={handleDeleteSelected}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                        >
                            <Trash className="w-4 h-4" /> Delete
                        </button>
                        <button onClick={() => setSelectedIds(new Set())} className="p-1.5 hover:bg-black/10 rounded-md ml-2">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-bg-secondary/30 rounded-xl border border-border/50 p-6 flex-1 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="text-center py-8 text-text-secondary">Loading sessions...</div>
                ) : filteredSessions.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary">No sessions found matching your filters.</div>
                ) : (
                    <Table data={filteredSessions} columns={columns} />
                )}
            </div>
        </div>
    );
}
