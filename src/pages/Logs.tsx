import { useMemo, useState, useEffect } from 'react';
import { useIsMobile } from '../utils/useIsMobile';
import { useSearchParams } from 'react-router-dom';
import { Table } from '../components';
import {
    AlertTriangle, X, Trash, Check,
    ChevronLeft, ChevronRight, Copy
} from 'lucide-react';
import { type Solve, useSolves } from '../contexts/SolvesContext';
import { useSettings } from '../contexts/SettingsContext';
import { detectOutliers } from '../utils/analysis';
import { useAuth } from '../contexts/AuthContext';
import { formatTime } from '../utils/formatTime';
import {
    ComposedChart,
    Line,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { calculateAverage, calculateBestSingle, calculateBestAverage } from '../utils/calculations';

import {
    startOfYear, startOfMonth, endOfMonth, startOfWeek,
    startOfDay, format, addMonths, subMonths,
    isSameDay, eachDayOfInterval, getDay
} from 'date-fns';

export default function Logs() {
    const { solves, updateSolve, deleteSolve } = useSolves();
    const { settings } = useSettings();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const isMobile = useIsMobile();

    // -- State: Sorting --
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>(() => {
        const saved = localStorage.getItem('data_table_sort');
        return saved ? JSON.parse(saved) : { key: 'date', direction: 'desc' };
    });

    useEffect(() => {
        localStorage.setItem('data_table_sort', JSON.stringify(sortConfig));
    }, [sortConfig]);

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

    // -- Filter Solves based on Sidebar Selection and Event --
    const filteredSolves = useMemo(() => {
        let base = solves;
        if (user) {
            base = solves.filter(s => s.userId === user.uid);
        }
        base = base.filter(s => (s.scrambleType || '333') === settings.scrambleType);

        const selectedStr = searchParams.get('selected');
        const grouping = searchParams.get('grouping') || 'sessions';

        if (!selectedStr) {
            return base.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }

        const selectedKeys = new Set(selectedStr.split(','));

        return base.filter(s => {
            const date = new Date(s.date);
            let key = '';
            switch (grouping) {
                case 'years':
                    key = format(startOfYear(date), 'yyyy');
                    break;
                case 'months':
                    key = format(startOfMonth(date), 'yyyy-MM');
                    break;
                case 'weeks':
                    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
                    key = format(weekStart, 'yyyy-Iw');
                    break;
                case 'days':
                    key = format(startOfDay(date), 'yyyy-MM-dd');
                    break;
                case 'sessions':
                    key = s.sessionId || 'unknown';
                    break;
            }
            return selectedKeys.has(key);
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    }, [solves, user, settings.scrambleType, searchParams]);

    // -- Anomalies (Excluding already approved anomalies permanently) --
    const anomalySolves = useMemo(() => {
        return filteredSolves.filter(s => {
            if (s.anomalyApproved) return false;
            const { isOutlier } = detectOutliers(s, filteredSolves);
            return isOutlier;
        });
    }, [filteredSolves]);

    // -- Table Data (Sorted) --
    const tableSolves = useMemo(() => {
        const data = [...filteredSolves];
        data.sort((a, b) => {
            let valA, valB;

            if (sortConfig.key === 'time') {
                const getSolveTime = (s: Solve) => {
                    if (s.penalty === 'DNF') return Infinity;
                    let t = s.time;
                    if (s.penalty === '+2') t += 2000;
                    if (s.inspectionPenalty === '+2') t += 2000;
                    return t;
                };
                valA = getSolveTime(a);
                valB = getSolveTime(b);
            } else {
                valA = new Date(a.date).getTime();
                valB = new Date(b.date).getTime();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return data;
    }, [filteredSolves, sortConfig]);

    const handleHeaderClick = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // -- Actions --
    const handleCopyScramble = (e: React.MouseEvent, scramble: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(scramble);
    };

    const handleAction = async (e: React.MouseEvent, action: 'delete' | 'approve', solve: Solve) => {
        e.stopPropagation();
        if (action === 'delete') {
            deleteSolve(solve.id);
            if (selectedSolveId === solve.id) setSelectedSolveId(null);
        } else if (action === 'approve') {
            updateSolve(solve.id, { anomalyApproved: true });
        }
    };

    // -- Prepare Data for Charts --
    const chartData = useMemo(() => {
        return filteredSolves.map((s, i) => {
            let ao5Current: number | null = null;
            if (i >= 4) {
                const window = filteredSolves.slice(i - 4, i + 1);
                const avg = calculateAverage(window, 5);
                if (typeof avg === 'number') ao5Current = avg;
            }

            const timeVal = (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') ? null : (s.time + (s.penalty === '+2' ? 2000 : 0) + (s.inspectionPenalty === '+2' ? 2000 : 0));

            return {
                id: s.id,
                index: i + 1,
                date: new Date(s.date).toLocaleDateString(),
                time: timeVal,
                ao5: ao5Current,
                solve: s
            };
        });
    }, [filteredSolves]);

    // -- Downsample Chart Data for Performance --
    const displayedChartData = useMemo(() => {
        const MAX_POINTS = 300;
        let data = chartData;

        if (chartData.length > MAX_POINTS) {
            const step = Math.ceil(chartData.length / MAX_POINTS);
            data = chartData.filter((_, i) => i % step === 0);
        }

        return data.map(d => ({
            ...d,
            time: (typeof d.time === 'number' && isFinite(d.time)) ? d.time : null,
            ao5: (typeof d.ao5 === 'number' && isFinite(d.ao5)) ? d.ao5 : null
        }));
    }, [chartData]);

    // -- Box Plot Data Calculation --
    const boxPlotStats = useMemo(() => {
        const validTimes = filteredSolves
            .filter(s => s.penalty !== 'DNF' && s.inspectionPenalty !== 'DNF')
            .map(s => s.time + (s.penalty === '+2' ? 2000 : 0) + (s.inspectionPenalty === '+2' ? 2000 : 0))
            .sort((a, b) => a - b);

        if (validTimes.length === 0) return null;

        const min = validTimes[0];
        const max = validTimes[validTimes.length - 1];
        const q1 = validTimes[Math.floor(validTimes.length * 0.25)];
        const median = validTimes[Math.floor(validTimes.length * 0.5)];
        const q3 = validTimes[Math.floor(validTimes.length * 0.75)];

        return { min, q1, median, q3, max };
    }, [filteredSolves]);

    // -- Detail Pane State --
    const [selectedSolveId, setSelectedSolveId] = useState<string | null>(null);

    const handleSolveClick = (solve: Solve) => {
        setSelectedSolveId(solve.id);
    };

    const selectedSolve = useMemo(() => {
        return solves.find(s => s.id === selectedSolveId);
    }, [solves, selectedSolveId]);

    // Smooth Scroll Helper
    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // -- Render --
    if (!user) {
        return <div className="p-8 text-center text-text-secondary">Please sign in to view data analysis.</div>;
    }

    if (filteredSolves.length === 0) {
        return <div className="p-8 text-center text-text-secondary">No solves selected or available.</div>;
    }

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative">
            {/* Top Sub-Navigation Header */}
            <nav className="sticky top-0 z-20 bg-bg-primary/95 backdrop-blur border-b border-border px-3 py-2 sm:px-6 sm:py-2.5 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
                <div className="flex items-center gap-1.5 min-w-max">
                    {anomalySolves.length > 0 && (
                        <button
                            onClick={() => scrollToSection('section-anomalies')}
                            className="flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-yellow-500 hover:bg-yellow-500/10 transition-colors cursor-pointer"
                        >
                            <span>Anomalies ({anomalySolves.length})</span>
                        </button>
                    )}

                    <button
                        onClick={() => scrollToSection('section-overview')}
                        className="flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
                    >
                        <span>Overview</span>
                    </button>

                    <button
                        onClick={() => scrollToSection('section-progression')}
                        className="flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
                    >
                        <span>Progression</span>
                    </button>

                    <button
                        onClick={() => scrollToSection('section-activity')}
                        className="flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
                    >
                        <span>Activity</span>
                    </button>

                    <button
                        onClick={() => scrollToSection('section-distribution')}
                        className="flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
                    >
                        <span>Distribution</span>
                    </button>

                    <button
                        onClick={() => scrollToSection('section-solves')}
                        className="flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
                    >
                        <span>Solves ({filteredSolves.length})</span>
                    </button>
                </div>

                <div className="text-xs text-text-secondary font-mono hidden sm:block">
                    {filteredSolves.length} solve{filteredSolves.length === 1 ? '' : 's'} isolated
                </div>
            </nav>

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
                                            const { reason } = detectOutliers(s, filteredSolves);
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

                    {/* Section 1: Progression Chart */}
                    <section id="section-progression" className="scroll-mt-4 w-full bg-bg-secondary/40 border border-border/50 rounded-xl p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-text-primary">Solve Time Progression</h3>
                            <div className="flex items-center gap-4 text-xs font-medium text-text-secondary">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Solve Time
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-0.5 bg-pink-500 inline-block" /> Moving Ao5
                                </span>
                            </div>
                        </div>

                        {filteredSolves.length < 5 ? (
                            <div className="w-full bg-bg-secondary/60 p-8 rounded-lg border border-border/40 flex flex-col items-center justify-center text-center h-64">
                                <AlertTriangle className="w-8 h-8 text-text-secondary mb-3 opacity-50" />
                                <h4 className="text-sm font-medium text-text-primary">Need More Solves</h4>
                                <p className="text-xs text-text-secondary mt-1 max-w-[250px]">
                                    Complete at least 5 solves to render the progression trendline.
                                </p>
                            </div>
                        ) : (
                            <div className="w-full h-[360px] min-w-0 pt-2">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
                                    <ComposedChart data={displayedChartData} margin={{ top: 10, right: 15, bottom: 5, left: -10 }}>
                                        <CartesianGrid stroke="#71717a" strokeOpacity={0.15} vertical={false} />
                                        <XAxis dataKey="index" hide />
                                        <YAxis
                                            domain={['auto', 'auto']}
                                            tickFormatter={(val) => {
                                                if (val > 60000) return formatTime(val);
                                                return (val / 1000).toFixed(1) + 's';
                                            }}
                                            width={55}
                                            tick={{ fontSize: 11, fill: '#71717a' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            cursor={{ stroke: 'rgba(100,100,100,0.2)' }}
                                            contentStyle={{
                                                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                                borderColor: '#27272a',
                                                fontSize: '12px',
                                                color: '#fff',
                                                borderRadius: '8px',
                                                boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.3)'
                                            }}
                                            itemStyle={{ color: '#e4e4e7' }}
                                            labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                                            formatter={(value: any, name: any) => {
                                                if (name === 'index') return [null, null];
                                                return [
                                                    value ? formatTime(value) : 'DNF',
                                                    name === 'time' ? 'Time' : (name === 'Ao5' ? 'Ao5' : name)
                                                ];
                                            }}
                                            labelFormatter={(label) => `Solve #${label}`}
                                        />
                                        <Scatter
                                            name="time"
                                            dataKey="time"
                                            fill="#3b82f6"
                                            opacity={0.6}
                                            shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={3} fill="#3b82f6" opacity={0.7} />}
                                            isAnimationActive={false}
                                        />
                                        <Line
                                            name="Ao5"
                                            type="monotone"
                                            dataKey="ao5"
                                            stroke="#ec4899"
                                            strokeWidth={2.5}
                                            dot={false}
                                            activeDot={false}
                                            connectNulls
                                            isAnimationActive={false}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </section>

                    {/* Section 2: Activity Calendar */}
                    <section id="section-activity" className="scroll-mt-4 w-full bg-bg-secondary/40 border border-border/50 rounded-xl p-5 flex flex-col gap-4 overflow-visible">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-text-primary">Activity & Consistency</h3>
                        </div>
                        <ActivityCalendar solves={filteredSolves} />
                    </section>

                    {/* Section 3: Distribution Box Plot */}
                    {boxPlotStats && (
                        <section id="section-distribution" className="scroll-mt-4 w-full bg-bg-secondary/40 border border-border/50 rounded-xl p-5 flex flex-col gap-2">
                            <h3 className="text-base font-bold text-text-primary">Time Distribution & Quartiles</h3>
                            <p className="text-xs text-text-secondary">Summary of minimum, 25th percentile, median, 75th percentile, and maximum solve times.</p>
                            <div className="w-full py-4">
                                <BoxPlot stats={boxPlotStats} />
                            </div>
                        </section>
                    )}

                    {/* Section 4: Solves History Table (without actions column) */}
                    <section id="section-solves" className="scroll-mt-4 w-full bg-bg-secondary/40 border border-border/50 rounded-xl p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-text-primary">Solves History ({filteredSolves.length})</h3>
                        </div>

                        <Table
                            data={tableSolves}
                            sortConfig={sortConfig}
                            onHeaderClick={handleHeaderClick}
                            className="w-full"
                            headerClassName="bg-bg-secondary border border-border"
                            rowClassName="border-none"
                            columns={[
                                { header: '#', accessor: (_: any, i: number) => tableSolves.length - i, className: 'w-16 text-center text-text-secondary/50' },
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
                                    className: 'hidden sm:table-cell w-auto'
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
                    </section>
                </div>

                {/* Viewer Pane (Side Panel) */}
                {selectedSolve && (
                    <SidebarPane
                        isMobile={isMobile}
                        solve={selectedSolve}
                        onClose={() => setSelectedSolveId(null)}
                        allSolves={filteredSolves}
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
                    const { isOutlier, reason } = detectOutliers(solve, allSolves);
                    if (isOutlier && !solve.anomalyApproved) {
                        return (
                            <div className="mx-2 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                                <div>
                                    <div className="text-yellow-500 font-bold text-sm mb-0.5">Anomaly Detected</div>
                                    <div className="text-yellow-500/80 text-xs mb-2">
                                        {reason === 'suspected_misclick' ? 'This time is unusually fast.' : 'This time is unusually slow.'}
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

function formatDuration(ms: number) {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m ${secs % 60}s`;
    return `${secs}s`;
}

function ActivityCalendar({ solves }: { solves: Solve[] }) {
    const [currentAnchorDate, setCurrentAnchorDate] = useState<Date>(() => startOfDay(new Date()));

    // Map of 'yyyy-MM-dd' -> Solves list
    const daySolvesMap = useMemo(() => {
        const map: Record<string, Solve[]> = {};
        solves.forEach(s => {
            const key = format(startOfDay(new Date(s.date)), 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push(s);
        });
        return map;
    }, [solves]);

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
                        const daySolves = (daySolvesMap[dateKey] || []).slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                        const count = daySolves.length;
                        const isToday = isSameDay(d, new Date());

                        const bestSingle = count > 0 ? calculateBestSingle(daySolves) : null;
                        const bestAo5 = count >= 5 ? calculateBestAverage(daySolves, 5) : null;
                        const bestAo12 = count >= 12 ? calculateBestAverage(daySolves, 12) : null;
                        const bestAo100 = count >= 100 ? calculateBestAverage(daySolves, 100) : null;
                        const totalPracticeTime = daySolves.reduce((acc, s) => {
                            if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return acc;
                            let t = s.time;
                            if (s.penalty === '+2') t += 2000;
                            if (s.inspectionPenalty === '+2') t += 2000;
                            return acc + t;
                        }, 0);

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
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:flex flex-col gap-1.5 bg-zinc-950 text-white text-[11px] px-3.5 py-2.5 rounded-lg border border-zinc-700 whitespace-nowrap z-[999] shadow-2xl pointer-events-none min-w-[175px]">
                                        <div className="font-semibold text-center border-b border-zinc-800 pb-1">
                                            {format(d, 'EEEE, MMM d, yyyy')}
                                        </div>
                                        <div className="flex flex-col gap-0.5 text-zinc-300 font-mono text-[10px]">
                                            <div className="flex justify-between items-center gap-3">
                                                <span className="text-zinc-400 font-sans">Solves:</span>
                                                <span className="font-bold text-white">{count}</span>
                                            </div>
                                            <div className="flex justify-between items-center gap-3">
                                                <span className="text-zinc-400 font-sans">Practice Time:</span>
                                                <span className="font-bold text-white">{formatDuration(totalPracticeTime)}</span>
                                            </div>
                                            {bestSingle !== null && (
                                                <div className="flex justify-between items-center gap-3">
                                                    <span className="text-zinc-400 font-sans">Best Single:</span>
                                                    <span className="font-bold text-white">{formatTime(bestSingle)}</span>
                                                </div>
                                            )}
                                            {bestAo5 !== null && bestAo5 !== 'DNF' && (
                                                <div className="flex justify-between items-center gap-3">
                                                    <span className="text-zinc-400 font-sans">Best Ao5:</span>
                                                    <span className="font-bold text-white">{formatTime(bestAo5)}</span>
                                                </div>
                                            )}
                                            {bestAo12 !== null && bestAo12 !== 'DNF' && (
                                                <div className="flex justify-between items-center gap-3">
                                                    <span className="text-zinc-400 font-sans">Best Ao12:</span>
                                                    <span className="font-bold text-white">{formatTime(bestAo12)}</span>
                                                </div>
                                            )}
                                            {bestAo100 !== null && bestAo100 !== 'DNF' && (
                                                <div className="flex justify-between items-center gap-3">
                                                    <span className="text-zinc-400 font-sans">Best Ao100:</span>
                                                    <span className="font-bold text-white">{formatTime(bestAo100)}</span>
                                                </div>
                                            )}
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
