import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Table from '../components/Table';
import { AlertTriangle, X } from 'lucide-react';
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
import { calculateAverage } from '../utils/calculations';

import { startOfYear, startOfMonth, startOfWeek, startOfDay, format } from 'date-fns';

export default function Data() {
    const { solves } = useSolves();
    const { settings } = useSettings();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    // -- Filter Solves based on Sidebar Selection and Event --
    const filteredSolves = useMemo(() => {
        // 1. Base Filter (User & Event)
        let base = solves;
        if (user) {
            base = solves.filter(s => s.userId === user.uid);
        }
        base = base.filter(s => (s.scrambleType || '333') === settings.scrambleType);

        // 2. Selection Filter (from URL)
        const selectedStr = searchParams.get('selected');
        const grouping = searchParams.get('grouping') || 'sessions'; // Default to match sidebar

        if (!selectedStr) {
            // "No specific grouping is selected, assume all solves for the event are selected."
            return base.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort for graphs (Oldest to Newest)
        }

        const selectedKeys = new Set(selectedStr.split(','));

        return base.filter(s => {
            const date = new Date(s.date);
            let key = '';
            // Replicate grouping logic from Sidebar to match keys
            // This duplication isn't ideal but avoids prop drilling or complex context for now.
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


    // -- Prepare Data for Charts --
    const chartData = useMemo(() => {
        return filteredSolves.map((s, i) => {
            // Calculate Moving Ao5
            // Get previous 4 + current
            let ao5Current: number | null = null;
            if (i >= 4) {
                const window = filteredSolves.slice(i - 4, i + 1);
                const avg = calculateAverage(window, 5); // Uses shared calculation
                if (typeof avg === 'number') ao5Current = avg;
            }

            const timeVal = (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') ? null : (s.time + (s.penalty === '+2' ? 2000 : 0) + (s.inspectionPenalty === '+2' ? 2000 : 0));

            return {
                id: s.id,
                index: i + 1,
                date: new Date(s.date).toLocaleDateString(),
                time: timeVal, // filtered out DNFs for scatter y-axis usually? or check if Recharts handles null
                ao5: ao5Current,
                solve: s
            };
        });
    }, [filteredSolves]);

    // -- Downsample Chart Data for Performance --
    const displayedChartData = useMemo(() => {
        const MAX_POINTS = 500;
        let data = chartData;

        // Downsample if too many points
        if (chartData.length > MAX_POINTS) {
            const step = Math.ceil(chartData.length / MAX_POINTS);
            data = chartData.filter((_, i) => i % step === 0);
        }

        // Always sanitize data for Recharts to prevent rendering crashes
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

    // -- Render --
    if (!user) {
        return <div className="p-8 text-center text-text-secondary">Please sign in to view data analysis.</div>;
    }

    if (filteredSolves.length === 0) {
        return <div className="p-8 text-center text-text-secondary">No solves selected or available.</div>;
    }

    return (
        <div className="w-full h-full flex relative">
            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-6 w-full min-w-0 pb-20"> {/* pb-20 for scrolling space */}
                <h2 className="text-2xl font-semibold text-text-primary px-1">Analysis</h2>

                {/* 1. Horizontal Box Plot */}
                {boxPlotStats && (
                    <div className="w-full bg-bg-secondary p-4 rounded-lg h-64 border border-border flex flex-col justify-center relative">
                        <h3 className="text-xs font-bold text-text-secondary uppercase">Distribution</h3>
                        <BoxPlot stats={boxPlotStats} />
                    </div>
                )}

                {/* 2. Scatter Plot with Trendline */}
                <div className="w-full bg-bg-secondary p-4 rounded-lg h-64 border border-border flex flex-col relative">
                    <h3 className="text-xs font-bold text-text-secondary uppercase">Trend</h3>
                    <div className="flex-1 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={displayedChartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                <XAxis dataKey="index" hide />
                                <YAxis
                                    domain={['auto', 'auto']}
                                    tickFormatter={(val) => (val / 1000).toFixed(1)}
                                    width={40}
                                    tick={{ fontSize: 10, fill: '#71717a' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '12px' }}
                                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                                    formatter={(value: any, name: any) => [
                                        value ? formatTime(value) : 'DNF',
                                        name === 'time' ? 'Time' : 'Ao5'
                                    ]}
                                    labelFormatter={(label) => `Solve #${label}`}
                                />
                                {/* Scatter for Individual Solves */}
                                <Scatter
                                    name="time"
                                    dataKey="time"
                                    fill="#3b82f6" // Blue
                                    opacity={0.5}
                                    shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={2} fill="#3b82f6" opacity={0.6} />}
                                />
                                {/* Line for Moving Average (Trend) */}
                                <Line
                                    type="monotone"
                                    dataKey="ao5"
                                    stroke="#ec4899" // Pink/Accent
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                    connectNulls
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Solves Table */}
                <div className="w-full">
                    <h3 className="text-lg font-medium text-text-primary mb-2 px-1">Solves ({filteredSolves.length})</h3>
                    {/* Using the standard table but wired to open side pane */}
                    <div className="rounded-lg border border-border overflow-hidden">
                        <Table
                            data={[...filteredSolves].reverse()} // Show newest first in table
                            columns={[
                                { header: '#', accessor: (_: any, i: number) => filteredSolves.length - i },
                                {
                                    header: 'Time',
                                    accessor: (s: Solve) => (
                                        <span className={`font-mono font-medium ${s.penalty === 'DNF' ? 'text-red-500' : ''}`}>
                                            {s.penalty === 'DNF' ? 'DNF' : formatTime(s.time + (s.penalty === '+2' ? 2000 : 0) + (s.inspectionPenalty === '+2' ? 2000 : 0))}
                                            {s.penalty === '+2' && '+'}
                                        </span>
                                    )
                                },
                                {
                                    header: 'Date',
                                    accessor: (s: Solve) => new Date(s.date).toLocaleDateString() + ' ' + new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                    className: 'hidden sm:table-cell text-text-secondary'
                                },
                            ]}
                            onRowClick={handleSolveClick}
                        />
                    </div>
                </div>
            </div>

            {/* Viewer Pane (Side Drawer) */}
            {selectedSolve && (
                <div className="absolute top-0 right-0 bottom-0 w-[300px] sm:w-[350px] bg-bg-secondary border-l border-border shadow-2xl z-20 overflow-y-auto animate-in slide-in-from-right duration-300">
                    <div className="p-4 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <h2 className="text-xl font-bold text-text-primary">Solve Details</h2>
                            <button onClick={() => setSelectedSolveId(null)} className="p-1 hover:bg-bg-hover rounded text-text-secondary">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Big Time Display */}
                        <div className="text-center py-6 border-b border-border/50">
                            <div className={`text-4xl font-mono font-bold ${selectedSolve.penalty === 'DNF' ? 'text-red-500' : 'text-accent'}`}>
                                {selectedSolve.penalty === 'DNF' ? 'DNF' : formatTime(selectedSolve.time + (selectedSolve.penalty === '+2' ? 2000 : 0))}
                            </div>
                            {selectedSolve.penalty !== 'none' && <div className="text-red-500 font-bold mt-1 uppercase">{selectedSolve.penalty} Penalty</div>}
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-text-secondary text-xs uppercase font-bold mb-1">Date</div>
                                <div className="text-text-primary">{new Date(selectedSolve.date).toLocaleDateString()}</div>
                                <div className="text-text-secondary text-xs">{new Date(selectedSolve.date).toLocaleTimeString()}</div>
                            </div>
                            <div>
                                <div className="text-text-secondary text-xs uppercase font-bold mb-1">Inspection</div>
                                <div className="text-text-primary font-mono">
                                    {selectedSolve.inspectionTime ? selectedSolve.inspectionTime.toFixed(2) + 's' : '-'}
                                </div>
                                {selectedSolve.inspectionPenalty !== 'none' && <span className="text-red-500 text-xs font-bold">({selectedSolve.inspectionPenalty})</span>}
                            </div>
                        </div>

                        {/* Scramble */}
                        <div>
                            <div className="text-text-secondary text-xs uppercase font-bold mb-1">Scramble</div>
                            <div className="bg-bg-tertiary p-3 rounded font-mono text-xs leading-relaxed break-all border border-border/50 text-text-primary/90">
                                {selectedSolve.scramble}
                            </div>
                        </div>

                        {/* Outlier Analysis */}
                        {(() => {
                            const { isOutlier, reason } = detectOutliers(selectedSolve.time, solves); // Pass all solves for context
                            if (isOutlier) {
                                return (
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                                        <div>
                                            <div className="text-yellow-500 font-bold text-sm mb-0.5">Anomaly Detected</div>
                                            <div className="text-yellow-500/80 text-xs">
                                                {reason === 'suspected_misclick' ? 'This time is unusually fast. Possible misclick?' : 'This time is unusually slow.'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}

// -- Simple SVG Box Plot Component --
function BoxPlot({ stats }: { stats: { min: number, q1: number, median: number, q3: number, max: number } }) {
    if (!stats) return null;
    const { min, q1, median, q3, max } = stats;
    // Normalize values to 0-100% width
    const range = max - min;
    if (range === 0) return <div className="text-center text-xs text-text-secondary mt-8">Not enough data range</div>;

    const getPos = (val: number) => ((val - min) / range) * 100;

    return (
        <div className="w-full h-16 relative mt-2 mb-2"> {/* Increased height and spacing */}
            {/* Main Line (Whisker to Whisker) */}
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-text-secondary/30 -translate-y-1/2"
                style={{ left: `${getPos(min)}%`, right: `${100 - getPos(max)}%` }} />

            {/* Whiskers (Ends) */}
            <div className="absolute top-1/2 w-[2px] h-3 bg-text-secondary/50 -translate-y-1/2" style={{ left: `${getPos(min)}%` }} />
            <div className="absolute top-1/2 w-[2px] h-3 bg-text-secondary/50 -translate-y-1/2" style={{ left: `${getPos(max)}%` }} />

            {/* Box (Q1 to Q3) */}
            <div className="absolute top-1/2 h-6 bg-blue-500/20 border border-blue-500/50 -translate-y-1/2 rounded-sm"
                style={{ left: `${getPos(q1)}%`, width: `${getPos(q3) - getPos(q1)}%` }} />

            {/* Median Line */}
            <div className="absolute top-1/2 w-[2px] h-6 bg-accent -translate-y-1/2 z-10"
                style={{ left: `${getPos(median)}%` }} />

            {/* Labels */}
            {/* Min/Max at ends */}
            <div className="absolute -bottom-0 text-[10px] font-mono text-text-secondary " style={{ left: `${getPos(min)}%` }}>{formatTime(min)}</div>
            <div className="absolute -bottom-0 text-[10px] font-mono text-text-secondary -translate-x-1/1" style={{ left: `${getPos(max)}%` }}>{formatTime(max)}</div>

            {/* Q1/Median/Q3 in middle */}
            <div className="absolute -top-0 text-[10px] font-mono text-text-secondary -translate-x-1/2 opacity-75" style={{ left: `${getPos(q1)}%` }}>{formatTime(q1)}</div>
            <div className="absolute -bottom-0 text-[10px] font-mono font-bold text-text-primary -translate-x-1/2" style={{ left: `${getPos(median)}%` }}>{formatTime(median)}</div>
            <div className="absolute -top-0 text-[10px] font-mono text-text-secondary -translate-x-1/2 opacity-75" style={{ left: `${getPos(q3)}%` }}>{formatTime(q3)}</div>
        </div>
    );
}


