import { useMemo, useState, useEffect, useRef } from 'react';
import { useIsMobile } from '../utils/useIsMobile';
import { useSearchParams, Link } from 'react-router-dom';
import { Table } from '../components';
import {
    AlertTriangle, X, Trash, Check,
    ChevronLeft, ChevronRight, Copy, Database
} from 'lucide-react';
import { type Solve, useSolves } from '../contexts/SolvesContext';
import { useSettings } from '../contexts/SettingsContext';

import { useAuth } from '../contexts/AuthContext';
import { formatTime } from '../utils/formatTime';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { LogsTableSettings } from '../types/auth';


import {
    startOfYear, startOfMonth, endOfMonth, startOfWeek,
    startOfDay, format, addMonths, subMonths,
    isSameDay, eachDayOfInterval, getDay
} from 'date-fns';

const DEFAULT_TABLE_SETTINGS: LogsTableSettings = {
    rowsPerPage: 25,
    sortConfig: {
        key: 'date',
        direction: 'desc'
    }
};

export default function Logs() {
    const { solves, updateSolve, deleteSolve, userStats } = useSolves();
    const { settings } = useSettings();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const isMobile = useIsMobile();

    // -- Table Settings (Default: 25 solves, newest to oldest; remembered per user account) --
    const [tableSettings, setTableSettings] = useState<LogsTableSettings>(() => {
        if (user?.logsTableSettings) {
            return user.logsTableSettings;
        }
        const storageKey = user?.uid ? `logs_table_settings_${user.uid}` : 'data_table_settings';
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return {
                    rowsPerPage: typeof parsed.rowsPerPage === 'number' ? parsed.rowsPerPage : 25,
                    sortConfig: parsed.sortConfig?.key ? parsed.sortConfig : { key: 'date', direction: 'desc' }
                };
            } catch (e) {
                console.error('Failed to parse saved table settings', e);
            }
        }
        return DEFAULT_TABLE_SETTINGS;
    });

    // Sync from user profile when loaded or changed from another device
    useEffect(() => {
        if (user?.logsTableSettings) {
            setTableSettings(prev => {
                if (
                    prev.rowsPerPage === user.logsTableSettings!.rowsPerPage &&
                    prev.sortConfig.key === user.logsTableSettings!.sortConfig.key &&
                    prev.sortConfig.direction === user.logsTableSettings!.sortConfig.direction
                ) {
                    return prev;
                }
                return user.logsTableSettings!;
            });
        }
    }, [user?.logsTableSettings]);

    const sortConfig = tableSettings.sortConfig;
    const rowsPerPage = tableSettings.rowsPerPage;

    const updateTableSettings = (updates: Partial<LogsTableSettings>) => {
        setTableSettings(prev => {
            const next: LogsTableSettings = {
                rowsPerPage: updates.rowsPerPage !== undefined ? updates.rowsPerPage : prev.rowsPerPage,
                sortConfig: updates.sortConfig !== undefined ? updates.sortConfig : prev.sortConfig
            };
            const storageKey = user?.uid ? `logs_table_settings_${user.uid}` : 'data_table_settings';
            localStorage.setItem(storageKey, JSON.stringify(next));
            localStorage.setItem('data_table_sort', JSON.stringify(next.sortConfig));

            if (user?.uid) {
                setDoc(doc(db, 'users', user.uid), {
                    logsTableSettings: next
                }, { merge: true }).catch(err => {
                    console.error('Failed to save table setup to account:', err);
                });
            }
            return next;
        });
    };

    const { updateSettings } = useSettings();

    // Scramble hotkeys on Logs page to switch active event filter
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) || target.isContentEditable)) {
                return;
            }

            if (e.key === '1') { updateSettings({ scrambleType: 'sq1' }); return; }
            if (e.key === '2') { updateSettings({ scrambleType: '222' }); return; }
            if (e.key === '3') { updateSettings({ scrambleType: '333' }); return; }
            if (e.key === '4') { updateSettings({ scrambleType: '444' }); return; }
            if (e.key === '5') { updateSettings({ scrambleType: '555' }); return; }
            if (e.key === '6') { updateSettings({ scrambleType: '666' }); return; }
            if (e.key === '7') { updateSettings({ scrambleType: '777' }); return; }
            if (e.key === 'c' || e.key === 'C') { updateSettings({ scrambleType: 'clock' }); return; }
            if (e.key === 'm' || e.key === 'M') { updateSettings({ scrambleType: 'minx' }); return; }
            if (e.key === 'p' || e.key === 'P') { updateSettings({ scrambleType: 'pyram' }); return; }
            if (e.key === 'k' || e.key === 'K') { updateSettings({ scrambleType: 'skewb' }); return; }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [updateSettings]);

    const [paginatedSolves, setPaginatedSolves] = useState<Solve[]>([]);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [anomalies, setAnomalies] = useState<Solve[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [approvedAnomalyIds, setApprovedAnomalyIds] = useState<Set<string>>(new Set());

    const pageCacheRef = useRef<Map<string, { solves: Solve[]; anomalies: Solve[] }>>(new Map());
    const totalCountRef = useRef<number | null>(totalCount);
    totalCountRef.current = totalCount;

    const grouping = searchParams.get('grouping') || 'sessions';
    const selectedStr = searchParams.get('selected');
    const selectedKeys = useMemo(() => selectedStr ? selectedStr.split(',').filter(Boolean) : [], [selectedStr]);

    // Reset page and clear cache when filters or sorting change
    const prevFilterRef = useRef({ scrambleType: settings.scrambleType, grouping, selectedStr });
    if (
        prevFilterRef.current.scrambleType !== settings.scrambleType ||
        prevFilterRef.current.grouping !== grouping ||
        prevFilterRef.current.selectedStr !== selectedStr
    ) {
        prevFilterRef.current = { scrambleType: settings.scrambleType, grouping, selectedStr };
        pageCacheRef.current.clear();
        setTotalCount(null);
        if (currentPage !== 1) {
            setCurrentPage(1);
        }
    }

    const prevSortPageRef = useRef({ rowsPerPage, sortKey: sortConfig.key, sortDirection: sortConfig.direction });
    if (
        prevSortPageRef.current.rowsPerPage !== rowsPerPage ||
        prevSortPageRef.current.sortKey !== sortConfig.key ||
        prevSortPageRef.current.sortDirection !== sortConfig.direction
    ) {
        prevSortPageRef.current = { rowsPerPage, sortKey: sortConfig.key, sortDirection: sortConfig.direction };
        pageCacheRef.current.clear();
        if (currentPage !== 1) {
            setCurrentPage(1);
        }
    }

    useEffect(() => {
        if (!user) {
            setPaginatedSolves([]);
            setTotalCount(0);
            setAnomalies([]);
            setLoading(false);
            return;
        }

        const cacheKey = `${currentPage}_${sortConfig.key}_${sortConfig.direction}_${rowsPerPage}_${settings.scrambleType}_${grouping}_${selectedStr || ''}`;

        // If this page is already cached in memory, use it immediately
        if (pageCacheRef.current.has(cacheKey)) {
            const cached = pageCacheRef.current.get(cacheKey)!;
            setPaginatedSolves(cached.solves);
            setAnomalies(cached.anomalies);
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const fetchSolves = async () => {
            try {
                const fn = httpsCallable(functions, 'getPaginatedSolves');
                const res = await fn({
                    scrambleType: settings.scrambleType,
                    grouping,
                    selectedKeys,
                    page: currentPage,
                    pageSize: rowsPerPage,
                    sortKey: sortConfig.key,
                    sortDirection: sortConfig.direction,
                    knownTotalCount: totalCountRef.current !== null ? totalCountRef.current : undefined
                });
                const data = res.data as { solves: Solve[]; totalCount: number; anomalies: Solve[] };
                if (isMounted) {
                    const fetchedSolves = data.solves || [];
                    const fetchedAnomalies = data.anomalies || [];
                    const fetchedTotal = typeof data.totalCount === 'number' ? data.totalCount : (totalCountRef.current ?? 0);

                    pageCacheRef.current.set(cacheKey, { solves: fetchedSolves, anomalies: fetchedAnomalies });
                    setPaginatedSolves(fetchedSolves);
                    setTotalCount(fetchedTotal);
                    setAnomalies(fetchedAnomalies);
                }
            } catch (err) {
                console.warn('Failed to fetch paginated solves from function:', err);
                if (isMounted) {
                    setPaginatedSolves([]);
                    setTotalCount(0);
                    setAnomalies([]);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchSolves();
        return () => { isMounted = false; };
    }, [user, settings.scrambleType, grouping, selectedKeys, selectedStr, currentPage, rowsPerPage, sortConfig.key, sortConfig.direction]);

    const safeTotalCount = totalCount ?? 0;
    const totalPages = Math.max(1, Math.ceil(safeTotalCount / rowsPerPage));
    const isInitialLoading = loading && totalCount === null;

    if (totalCount !== null && totalCount > 0 && currentPage > totalPages) {
        setCurrentPage(totalPages);
    }

    const anomalySolves = useMemo(() => {
        return anomalies.filter(s => !s.anomalyApproved && !approvedAnomalyIds.has(s.id));
    }, [anomalies, approvedAnomalyIds]);

    const handleHeaderClick = (key: string) => {
        const nextDirection = sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc';
        updateTableSettings({
            sortConfig: {
                key,
                direction: nextDirection
            }
        });
    };

    const handleRowsPerPageChange = (newRows: number) => {
        updateTableSettings({
            rowsPerPage: newRows
        });
    };

    // -- Actions --
    const handleCopyScramble = (e: React.MouseEvent, scramble: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(scramble);
    };

    const handleAction = async (e: React.MouseEvent, action: 'delete' | 'approve', solve: Solve) => {
        e.stopPropagation();
        if (action === 'delete') {
            await deleteSolve(solve.id);
            pageCacheRef.current.clear();
            setPaginatedSolves(prev => prev.filter(s => s.id !== solve.id));
            setAnomalies(prev => prev.filter(s => s.id !== solve.id));
            setTotalCount(prev => (prev !== null ? Math.max(0, prev - 1) : 0));
            if (selectedSolveId === solve.id) setSelectedSolveId(null);
        } else if (action === 'approve') {
            await updateSolve(solve.id, { anomalyApproved: true });
            pageCacheRef.current.clear();
            setApprovedAnomalyIds(prev => new Set(prev).add(solve.id));
            setAnomalies(prev => prev.filter(s => s.id !== solve.id));
        }
    };

    // -- Detail Pane State --
    const [selectedSolveId, setSelectedSolveId] = useState<string | null>(null);

    const handleSolveClick = (solve: Solve) => {
        setSelectedSolveId(solve.id);
    };

    const selectedSolve = useMemo(() => {
        if (!selectedSolveId) return null;
        return paginatedSolves.find(s => s.id === selectedSolveId) || anomalySolves.find(s => s.id === selectedSolveId) || null;
    }, [paginatedSolves, anomalySolves, selectedSolveId]);

    // -- Render --
    if (!user || user.isAnonymous) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-bg-secondary rounded-2xl flex items-center justify-center mb-4 border border-border/80 shadow-sm">
                    <Database className="w-8 h-8 text-text-secondary" />
                </div>
                <h2 className="text-xl font-bold text-text-primary mb-2 tracking-tight">Data Logs Locked</h2>
                <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
                    Sign in to your account to unlock comprehensive solve logs, advanced analytics, and anomaly detection.
                </p>
                <Link
                    to="/account"
                    state={{ mode: 'signin' }}
                    className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition-all"
                >
                    Sign In
                </Link>
            </div>
        );
    }

    const showEmptyState = !isInitialLoading && !loading && safeTotalCount === 0;

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative">
            <div className="flex-1 flex flex-row overflow-hidden relative">
                {/* Main Scrollable Content */}
                <div className="flex-1 flex flex-col gap-6 sm:gap-8 w-full min-w-0 pb-20 sm:pb-24 overflow-y-auto px-2.5 py-4 sm:px-6 sm:py-6 custom-scrollbar">

                    {/* Section: Anomalies (Rendered first when detected) */}
                    {anomalySolves.length > 0 && (
                        <section id="section-anomalies" className="scroll-mt-4 w-full bg-bg-secondary/40 border border-border/50 rounded-xl p-5 flex flex-col gap-4">
                            <h3 className="text-base font-bold text-text-primary">Detected Anomalies ({anomalySolves.length})</h3>
                            <Table
                                data={anomalySolves}
                                sortConfig={{ key: 'date', direction: 'desc' }}
                                onHeaderClick={() => { }}
                                className="w-full"
                                headerClassName="bg-bg-secondary border border-border"
                                rowClassName="border-none hover:bg-yellow-500/5 text-text-secondary"
                                columns={[
                                    { header: '#', accessor: (_: any, i: number) => anomalySolves.length - i, className: 'w-12 text-center text-text-secondary/50' },
                                    {
                                        header: 'Time',
                                        accessor: (s: Solve) => (
                                            <span className={`font-mono font-medium ${s.penalty === 'DNF' ? 'text-red-500' : 'text-yellow-500'}`}>
                                                {formatTime(s.time + (s.penalty === '+2' ? 2000 : 0) + (s.inspectionPenalty === '+2' ? 2000 : 0))}
                                            </span>
                                        )
                                    },
                                    {
                                        header: 'Issue',
                                        accessor: (s: Solve) => {
                                            const reason = (s as any).anomalyReason;
                                            return (
                                                <span className="text-xs text-text-secondary">
                                                    {reason === 'suspected_misclick' ? 'Unusually Fast' : 'Unusually Slow'}
                                                </span>
                                            );
                                        },
                                        className: 'text-text-secondary'
                                    },
                                    {
                                        header: 'Date',
                                        accessor: (s: Solve) => new Date(s.date).toLocaleDateString(),
                                        className: 'text-text-secondary text-right w-40'
                                    },
                                    {
                                        header: 'Actions',
                                        accessor: (s: Solve) => (
                                            <div className="flex items-center gap-2 justify-end pr-1">
                                                <button onClick={(e) => handleAction(e, 'approve', s)} className="px-3 py-1 bg-bg-tertiary hover:bg-green-500/20 rounded text-xs font-medium text-text-primary hover:text-green-500 flex items-center gap-1 transition-colors cursor-pointer">
                                                    <Check className="w-3 h-3" /> Approve
                                                </button>
                                                <button onClick={(e) => handleAction(e, 'delete', s)} className="px-3 py-1 bg-bg-tertiary hover:bg-red-500/20 rounded text-xs font-medium text-text-primary hover:text-red-500 flex items-center gap-1 transition-colors cursor-pointer">
                                                    <Trash className="w-3 h-3" /> Delete
                                                </button>
                                            </div>
                                        ),
                                        className: 'w-48 text-right'
                                    }
                                ]}
                            />
                        </section>
                    )}

                    {/* Section 4: Solves History Table (moved to top) */}
                    <section id="section-solves" className="scroll-mt-4 w-full bg-bg-secondary/40 border border-border/50 rounded-xl p-5 flex flex-col gap-4">
                        {/* Table Controls: Showing count (left), Pagination (center), Show X dropdown (right) */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 text-xs text-text-secondary">
                                {isInitialLoading ? (
                                    <span className="inline-block h-3.5 w-32 bg-text-secondary/20 rounded animate-pulse align-middle" />
                                ) : (
                                    `Showing ${safeTotalCount === 0 ? 0 : `${(currentPage - 1) * rowsPerPage + 1} to ${Math.min(currentPage * rowsPerPage, safeTotalCount)}`} of ${safeTotalCount} solves`
                                )}
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1 || isInitialLoading}
                                    className="p-1.5 rounded bg-bg-secondary text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer disabled:cursor-not-allowed"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <div className="text-xs font-medium text-text-primary select-none whitespace-nowrap">
                                    {isInitialLoading ? (
                                        <span className="inline-block h-3.5 w-16 bg-text-secondary/20 rounded animate-pulse align-middle" />
                                    ) : (
                                        `Page ${currentPage} of ${totalPages}`
                                    )}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || isInitialLoading}
                                    className="p-1.5 rounded bg-bg-secondary text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer disabled:cursor-not-allowed"
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 flex items-center justify-end gap-2">
                                <span className="text-xs text-text-secondary">Show:</span>
                                <select 
                                    className="bg-bg-secondary text-text-primary text-xs border border-border rounded px-2 py-1 outline-none focus:border-accent cursor-pointer"
                                    value={rowsPerPage}
                                    onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
                                    disabled={isInitialLoading}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                        {showEmptyState ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center p-4 gap-2 border border-border/50 rounded-xl bg-bg-secondary/20">
                                <span className="text-sm font-semibold text-text-primary">No solves selected or available</span>
                                <p className="text-xs text-text-secondary max-w-sm">
                                    Complete solves in this event or select a different session/filter in the sidebar.
                                </p>
                            </div>
                        ) : loading ? (
                            <div className="w-full overflow-x-auto border border-border rounded-lg">
                                <table className="w-full text-left text-sm border-collapse table-fixed select-none">
                                    <thead className="bg-bg-secondary border border-border">
                                        <tr>
                                            <th className="p-3 font-medium text-text-secondary border-b border-border w-16 text-center">
                                                <div className="flex items-center gap-1 justify-center">#</div>
                                            </th>
                                            <th className="p-3 font-medium text-text-secondary border-b border-border w-28">
                                                <div className="flex items-center gap-1">Time</div>
                                            </th>
                                            <th className="p-3 font-medium text-text-secondary border-b border-border hidden sm:table-cell max-w-[150px] truncate">
                                                <div className="flex items-center gap-1">Scramble</div>
                                            </th>
                                            <th className="p-3 font-medium text-text-secondary border-b border-border text-text-secondary w-48 text-right">
                                                <div className="flex items-center gap-1 justify-end">Date</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {Array.from({ length: Math.min(rowsPerPage, 10) }).map((_, idx) => (
                                            <tr key={idx} className="border-none hover:bg-bg-hover/40 transition-colors">
                                                <td className="p-3 w-16 text-center">
                                                    <span className="inline-block h-3.5 w-6 bg-text-secondary/20 rounded animate-pulse align-middle" />
                                                </td>
                                                <td className="p-3 w-28">
                                                    <span className="inline-block h-4 w-16 bg-text-secondary/20 rounded animate-pulse align-middle" />
                                                </td>
                                                <td className="p-3 hidden sm:table-cell max-w-[150px]">
                                                    <span className="inline-block h-3.5 w-4/5 bg-text-secondary/20 rounded animate-pulse align-middle" />
                                                </td>
                                                <td className="p-3 text-text-secondary w-48 text-right">
                                                    <span className="inline-block h-3.5 w-28 bg-text-secondary/20 rounded animate-pulse align-middle" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <Table
                                data={paginatedSolves}
                                sortConfig={sortConfig}
                                onHeaderClick={handleHeaderClick}
                                className="w-full"
                                tableClassName="table-fixed"
                                headerClassName="bg-bg-secondary border border-border"
                                rowClassName="border-none"
                                columns={[
                                    { 
                                        header: '#', 
                                        accessor: (s: Solve, i: number) => (
                                            <div className="flex items-center justify-center w-full relative">
                                                <span className="group-hover:opacity-0 transition-opacity">
                                                    {sortConfig.direction === 'desc'
                                                        ? safeTotalCount - ((currentPage - 1) * rowsPerPage + i)
                                                        : ((currentPage - 1) * rowsPerPage + i + 1)}
                                                </span>
                                                <button 
                                                    onClick={(e) => handleAction(e, 'delete', s)}
                                                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-500 transition-opacity"
                                                    title="Delete Solve"
                                                >
                                                    <Trash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ), 
                                        className: 'w-16 text-center text-text-secondary/50' 
                                    },
                                    {
                                        header: 'Time',
                                        key: 'time',
                                        sortable: true,
                                        accessor: (s: Solve) => (
                                            <span className={`font-mono font-medium ${s.penalty === 'DNF' ? 'text-red-500' : ''}`}>
                                                {s.penalty === 'DNF' ? 'DNF' : formatTime(s.time + (s.penalty === '+2' ? 2000 : 0) + (s.inspectionPenalty === '+2' ? 2000 : 0))}
                                                {s.penalty === '+2' && '+'}
                                            </span>
                                        ),
                                        className: 'w-28'
                                    },
                                    {
                                        header: 'Scramble',
                                        accessor: (s: Solve) => (
                                            <div
                                                onClick={(e) => handleCopyScramble(e, s.scramble)}
                                                className="font-mono text-xs text-text-secondary cursor-copy hover:text-text-primary transition-colors flex items-center justify-between gap-2 group/scramble w-full"
                                                title="Click to copy"
                                            >
                                                <span className="truncate">{s.scramble}</span>
                                                <Copy className="w-3 h-3 opacity-0 group-hover/scramble:opacity-100 transition-opacity shrink-0" />
                                            </div>
                                        ),
                                        className: 'hidden sm:table-cell max-w-[150px] truncate'
                                    },
                                    {
                                        header: 'Date',
                                        key: 'date',
                                        sortable: true,
                                        accessor: (s: Solve) => new Date(s.date).toLocaleDateString() + ' ' + new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                        className: 'text-text-secondary w-48 text-right'
                                    }
                                ]}
                                onRowClick={handleSolveClick}
                            />
                        )}
                    </section>
                </div>

                {/* Viewer Pane (Side Panel) */}
                {selectedSolve && (
                    <SidebarPane
                        isMobile={isMobile}
                        solve={selectedSolve}
                        onClose={() => setSelectedSolveId(null)}
                        allSolves={anomalySolves}
                        onAction={handleAction}
                        selectedSolveId={selectedSolveId}
                    />
                )}
            </div>
        </div>
    );
}

function SidebarPane({ solve, onClose, allSolves, onAction, selectedSolveId, isMobile }: { solve: Solve, onClose: () => void, allSolves: Solve[], onAction: any, selectedSolveId: string | null, isMobile?: boolean }) {
    const [width, setWidth] = useState(350);

    return (
        <div
            className={`flex flex-col bg-bg-secondary h-full overflow-y-auto animate-in slide-in-from-right duration-300 shrink-0 ${isMobile ? 'fixed inset-0 z-[70] pb-[env(safe-area-inset-bottom)]' : 'border-l border-border relative z-20'}`}
            style={{ width: isMobile ? '100%' : width }}
        >
            {/* Resize Handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-accent/50 transition-colors z-30"
                onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = width;

                    const onMouseMove = (ev: MouseEvent) => {
                        const newWidth = startWidth - (ev.clientX - startX);
                        setWidth(Math.max(300, Math.min(600, newWidth)));
                    };

                    const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    };

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                }}
            />

            <div className="p-4 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold text-text-primary">Solve Details</h2>
                        <span className="text-xs text-text-secondary font-mono">#{selectedSolveId?.slice(0, 8)}</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-bg-hover rounded text-text-secondary cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Big Time Display */}
                <div className="text-left px-2 py-4 border-b border-border/50">
                    <div className={`text-4xl font-mono font-bold ${solve.penalty === 'DNF' ? 'text-red-500' : 'text-accent'}`}>
                        {solve.penalty === 'DNF' ? 'DNF' : formatTime(solve.time + (solve.penalty === '+2' ? 2000 : 0))}
                    </div>
                    {solve.penalty !== 'none' && <div className="text-red-500 font-bold mt-1 uppercase text-sm">{solve.penalty} Penalty</div>}
                </div>

                {/* Details List (Single Column) */}
                <div className="flex flex-col gap-6 px-2">
                    <div>
                        <div className="text-text-secondary text-xs uppercase font-bold mb-1">Date</div>
                        <div className="text-text-primary text-sm flex flex-col">
                            <span>{new Date(solve.date).toLocaleDateString()}</span>
                            <span className="text-text-secondary text-xs">{new Date(solve.date).toLocaleTimeString()}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-text-secondary text-xs uppercase font-bold mb-1">Inspection</div>
                        <div className="text-text-primary font-mono text-sm">
                            {solve.inspectionTime ? (solve.inspectionTime / 1000).toFixed(2) + 's' : '-'}
                        </div>
                        {solve.inspectionPenalty !== 'none' && <span className="text-red-500 text-xs font-bold">({solve.inspectionPenalty})</span>}
                    </div>
                    <div>
                        <div className="text-text-secondary text-xs uppercase font-bold mb-1">Scramble</div>
                        <div className="font-mono text-xs leading-relaxed break-all text-text-primary/90">
                            {solve.scramble}
                        </div>
                    </div>
                </div>

                {/* Outlier Analysis Details */}
                {(() => {
                    const isOutlier = allSolves.some(a => a.id === solve.id);
                    if (isOutlier && !solve.anomalyApproved) {
                        return (
                            <div className="mx-2 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                                <div>
                                    <div className="text-yellow-500 font-bold text-sm mb-0.5">Anomaly Detected</div>
                                    <div className="text-yellow-500/80 text-xs mb-2">
                                        {(solve as any).anomalyReason === 'suspected_misclick' ? 'This time is unusually fast.' : 'This time is unusually slow.'}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={(e) => onAction(e, 'approve', solve)} className="text-xs font-bold text-yellow-500 hover:text-yellow-400 underline decoration-dotted cursor-pointer">Approve</button>
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>
        </div>
    );
}

// -- Calendar View Helpers --
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getHeatmapColor(count: number) {
    if (count === 0) return 'bg-bg-secondary/60 text-text-secondary/40 border border-border/30 hover:border-border';
    if (count < 10) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-medium hover:border-emerald-400';
    if (count < 25) return 'bg-emerald-500/40 text-emerald-200 border border-emerald-500/60 font-semibold hover:border-emerald-300';
    if (count < 50) return 'bg-emerald-600 text-white border border-emerald-500 font-bold hover:brightness-110';
    return 'bg-emerald-700 text-white border border-emerald-400 font-bold shadow-sm shadow-emerald-950/40 hover:brightness-110';
}



function ActivityCalendar({ dailySolvesCount }: { dailySolvesCount?: Record<string, number> }) {
    const [currentAnchorDate, setCurrentAnchorDate] = useState<Date>(() => startOfDay(new Date()));

    const daySolvesMap = useMemo(() => {
        return dailySolvesCount || {};
    }, [dailySolvesCount]);

    // Navigation handlers
    const handlePrev = () => {
        setCurrentAnchorDate(prev => subMonths(prev, 1));
    };

    const handleNext = () => {
        setCurrentAnchorDate(prev => addMonths(prev, 1));
    };

    const handleToday = () => {
        setCurrentAnchorDate(startOfDay(new Date()));
    };

    const headerTitle = useMemo(() => {
        return format(currentAnchorDate, 'MMMM yyyy');
    }, [currentAnchorDate]);

    // Render Month Grid
    const renderMonthGrid = (monthDate: Date) => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        // Day offset: Monday is 0, Sunday is 6
        const startDayOffset = (getDay(monthStart) + 6) % 7;

        return (
            <div
                key={format(monthDate, 'yyyy-MM')}
                className="w-full max-w-xl mx-auto flex flex-col gap-2.5 transition-all overflow-visible"
            >
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-2 text-[11px] font-bold text-text-secondary text-center pb-1 border-b border-border/20">
                    {WEEKDAYS.map(w => (
                        <div key={w} className="truncate">{w}</div>
                    ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2 overflow-visible pt-1">
                    {/* Empty placeholder cells for days before the 1st */}
                    {Array.from({ length: startDayOffset }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="aspect-square opacity-0 pointer-events-none" />
                    ))}

                    {/* Actual month days */}
                    {daysInMonth.map(d => {
                        const dateKey = format(d, 'yyyy-MM-dd');
                        const count = daySolvesMap[dateKey] || 0;
                        const isToday = isSameDay(d, new Date());

                        return (
                            <div
                                key={dateKey}
                                className={`
                                    aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all relative group cursor-default
                                    ${getHeatmapColor(count)}
                                    ${isToday ? 'ring-2 ring-accent font-bold' : ''}
                                `}
                            >
                                <span className="text-xs leading-none">{format(d, 'd')}</span>
                                {count > 0 && (
                                    <span className="text-[9px] font-mono opacity-90 leading-none mt-0.5">{count}</span>
                                )}

                                {/* Hover Tooltip: Solid High-Z Popover with arrow */}
                                {count > 0 ? (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:flex flex-col gap-1.5 bg-zinc-950 text-white text-[11px] px-3.5 py-2.5 rounded-lg border border-zinc-700 whitespace-nowrap z-[999] shadow-2xl pointer-events-none min-w-[120px]">
                                        <div className="font-semibold text-center border-b border-zinc-800 pb-1">
                                            {format(d, 'EEEE, MMM d, yyyy')}
                                        </div>
                                        <div className="flex flex-col gap-0.5 text-zinc-300 font-mono text-[10px]">
                                            <div className="flex justify-between items-center gap-3">
                                                <span className="text-zinc-400 font-sans">Solves:</span>
                                                <span className="font-bold text-white">{count}</span>
                                            </div>
                                        </div>
                                        <div className="w-2 h-2 bg-zinc-950 border-r border-b border-zinc-700 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
                                    </div>
                                ) : (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:flex flex-col items-center bg-zinc-950 text-white text-[11px] px-3 py-1.5 rounded-md border border-zinc-700 whitespace-nowrap z-[999] shadow-2xl pointer-events-none">
                                        <span className="font-semibold">{format(d, 'EEEE, MMM d, yyyy')}</span>
                                        <span className="text-[10px] text-zinc-400 font-mono mt-0.5">0 solves</span>
                                        <div className="w-2 h-2 bg-zinc-950 border-r border-b border-zinc-700 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-4 w-full overflow-visible">
            {/* Top Toolbar: Navigation Controls */}
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/40">
                {/* Period Navigation */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrev}
                        className="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Previous month"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold text-text-primary min-w-[150px] text-center font-mono">
                        {headerTitle}
                    </span>
                    <button
                        onClick={handleNext}
                        className="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Next month"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleToday}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-bg-secondary border border-border hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer ml-1"
                    >
                        Today
                    </button>
                </div>
            </div>

            {/* Calendar View Container */}
            <div className="w-full overflow-visible py-2">
                {renderMonthGrid(currentAnchorDate)}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 text-xs text-text-secondary pt-2 border-t border-border/30">
                <span>Less</span>
                <span className="w-3.5 h-3.5 rounded bg-bg-secondary/60 border border-border/30" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-500/20 border border-emerald-500/40" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-500/40 border border-emerald-500/60" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-600" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-700" />
                <span>More</span>
            </div>
        </div>
    );
}

// -- Simple SVG Box Plot Component --
function BoxPlot({ stats }: { stats: { min: number, q1: number, median: number, q3: number, max: number } }) {
    if (!stats) return null;
    const { min, q1, median, q3, max } = stats;
    const range = max - min;
    if (range === 0) return <div className="text-center text-xs text-text-secondary mt-4">Not enough data range</div>;

    const getPos = (val: number) => ((val - min) / range) * 100;

    return (
        <div className="w-full h-16 relative my-2">
            {/* Main Line (Whisker to Whisker) */}
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-text-secondary/30 -translate-y-1/2"
                style={{ left: `${getPos(min)}%`, right: `${100 - getPos(max)}%` }} />

            {/* Whiskers (Ends) */}
            <div className="absolute top-1/2 w-[2px] h-3 bg-text-secondary/50 -translate-y-1/2" style={{ left: `${getPos(min)}%` }} />
            <div className="absolute top-1/2 w-[2px] h-3 bg-text-secondary/50 -translate-y-1/2" style={{ left: `${getPos(max)}%` }} />

            {/* Box (Q1 to Q3) */}
            <div className="absolute top-1/2 h-6 bg-blue-500/20 border border-blue-500/50 -translate-y-1/2"
                style={{ left: `${getPos(q1)}%`, width: `${getPos(q3) - getPos(q1)}%` }} />

            {/* Median Line */}
            <div className="absolute top-1/2 w-[2px] h-6 bg-accent -translate-y-1/2 z-10"
                style={{ left: `${getPos(median)}%` }} />

            {/* Labels */}
            <div className="absolute -bottom-0 text-xs font-mono text-text-secondary" style={{ left: `${getPos(min)}%` }}>{formatTime(min)}</div>
            <div className="absolute -bottom-0 text-xs font-mono text-text-secondary -translate-x-1/1" style={{ left: `${getPos(max)}%` }}>{formatTime(max)}</div>

            <div className="absolute -top-0 text-xs font-mono text-text-secondary -translate-x-1/2 opacity-75" style={{ left: `${getPos(q1)}%` }}>{formatTime(q1)}</div>
            <div className="absolute -bottom-0 text-xs font-mono font-bold text-text-primary -translate-x-1/2" style={{ left: `${getPos(median)}%` }}>{formatTime(median)}</div>
            <div className="absolute -top-0 text-xs font-mono text-text-secondary -translate-x-1/2 opacity-75" style={{ left: `${getPos(q3)}%` }}>{formatTime(q3)}</div>
        </div>
    );
}
