import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSolves, type Solve } from '../../contexts/SolvesContext';
import { useAuth } from '../../contexts/AuthContext';
import { SCRAMBLE_TYPES, SUPPORTED_EVENT_IDS } from '../../utils/constants';
import { formatTime } from '../../utils/calculations';
import {
    type EventRecordRow,
    type RecordDetail,
    calculateBestSingleRecord,
    calculateBestAverageRecord,
    getRecencyTier,
    getRecencyClasses,
    getDropsCount,
    getEffectiveTime
} from '../../utils/recordCalculations';
import {
    Trophy,
    X,
    Copy,
    Check,
    Calendar,
    Flame,
    Sparkles,
    Layers,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';

export interface RecordTableProps {
    solves?: Solve[];
    userId?: string;
    hideFootnote?: boolean;
}

export default function RecordTable({ solves: customSolves, userId, hideFootnote = false }: RecordTableProps = {}) {
    const { solves: contextSolves } = useSolves();
    const { user } = useAuth();

    const [selectedRecord, setSelectedRecord] = useState<{
        eventName: string;
        eventType: string;
        detail: RecordDetail;
    } | null>(null);

    // Filter solves based on auth or custom user
    const relevantSolves = useMemo(() => {
        if (customSolves) {
            return customSolves;
        }
        const targetUid = userId || user?.uid;
        if (targetUid) {
            return contextSolves.filter(s => s.userId === targetUid);
        }
        return contextSolves;
    }, [customSolves, contextSolves, userId, user?.uid]);

    // Group solves and compute all event records
    const rows = useMemo(() => {
        // Group by event
        const grouped: Record<string, Solve[]> = {};

        relevantSolves.forEach(s => {
            const type = s.scrambleType || '333';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(s);
        });

        // Compute rows for each supported event
        const eventRows: EventRecordRow[] = [];

        // Iterate through SCRAMBLE_TYPES order
        SCRAMBLE_TYPES.forEach(opt => {
            const type = opt.value;
            const eventSolves = grouped[type] || [];
            if (eventSolves.length === 0 && !SUPPORTED_EVENT_IDS.includes(type)) return;
            if (eventSolves.length === 0) return; // Only show events with >0 solves

            // Sort chronological (oldest to newest) for sliding window calculation
            const chronologicalSolves = [...eventSolves].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            // Valid non-DNF solves for event mean and std
            const validSolves = eventSolves.filter(
                s => s.penalty !== 'DNF' && s.inspectionPenalty !== 'DNF'
            );

            const eventTotalTime = validSolves.reduce((acc, s) => acc + getEffectiveTime(s), 0);

            const mean = validSolves.length > 0
                ? Math.round(eventTotalTime / validSolves.length)
                : null;

            let std: number | null = null;
            if (validSolves.length > 1 && mean !== null) {
                const variance = validSolves.reduce((acc, s) => {
                    const t = getEffectiveTime(s);
                    return acc + Math.pow(t - mean, 2);
                }, 0) / validSolves.length;
                std = Math.sqrt(variance);
            }

            // Calculate all bests
            const single = calculateBestSingleRecord(eventSolves);
            const ao5 = calculateBestAverageRecord(chronologicalSolves, 5, 'ao5', 'Ao5', false);
            const ao12 = calculateBestAverageRecord(chronologicalSolves, 12, 'ao12', 'Ao12', false);
            const ao50 = calculateBestAverageRecord(chronologicalSolves, 50, 'ao50', 'Ao50', false);
            const ao100 = calculateBestAverageRecord(chronologicalSolves, 100, 'ao100', 'Ao100', false);
            const ao250 = calculateBestAverageRecord(chronologicalSolves, 250, 'ao250', 'Ao250', true);
            const ao1000 = calculateBestAverageRecord(chronologicalSolves, 1000, 'ao1000', 'Ao1000', true);

            eventRows.push({
                type,
                label: opt.label,
                count: eventSolves.length,
                totalTime: eventTotalTime,
                mean,
                std,
                single,
                ao5,
                ao12,
                ao50,
                ao100,
                ao250,
                ao1000
            });
        });

        return eventRows;
    }, [relevantSolves]);

    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const handleRecordClick = (eventName: string, eventType: string, detail: RecordDetail | null) => {
        if (!detail) return;
        setSelectedRecord({
            eventName,
            eventType,
            detail
        });
    };

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedRecord) {
                setSelectedRecord(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRecord]);

    return (
        <div className="flex flex-col gap-2 font-sans select-none">
            {/* Table Container */}
            <div className="bg-surface-elevation-1 border border-border rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left border-collapse select-none">
                        <thead>
                            <tr className="text-xs uppercase bg-bg-secondary text-text-secondary border-b border-border">
                                <th className="px-4 py-3 font-semibold text-left whitespace-nowrap">Event</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Solves</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Mean</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Std</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Time</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Single</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Ao5</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Ao12</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Ao50</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Ao100</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap" title="Cross-session eligible">Ao250*</th>
                                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap" title="Cross-session eligible">Ao1000*</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {rows.map(row => (
                                <tr key={row.type} className="hover:bg-bg-hover/40 transition-colors">
                                    <td className="px-4 py-2.5 font-semibold text-text-primary whitespace-nowrap">
                                        {row.label}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs">
                                        {row.count}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs">
                                        {row.mean !== null ? formatTime(row.mean) : '-'}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs">
                                        {row.std !== null ? (row.std / 1000).toFixed(2) : '-'}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs whitespace-nowrap">
                                        {formatDuration(row.totalTime)}
                                    </td>

                                    {/* Record Cells */}
                                    <RecordCell
                                        eventName={row.label}
                                        eventType={row.type}
                                        detail={row.single}
                                        isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'single'}
                                        onClick={handleRecordClick}
                                    />
                                    <RecordCell
                                        eventName={row.label}
                                        eventType={row.type}
                                        detail={row.ao5}
                                        isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao5'}
                                        onClick={handleRecordClick}
                                    />
                                    <RecordCell
                                        eventName={row.label}
                                        eventType={row.type}
                                        detail={row.ao12}
                                        isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao12'}
                                        onClick={handleRecordClick}
                                    />
                                    <RecordCell
                                        eventName={row.label}
                                        eventType={row.type}
                                        detail={row.ao50}
                                        isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao50'}
                                        onClick={handleRecordClick}
                                    />
                                    <RecordCell
                                        eventName={row.label}
                                        eventType={row.type}
                                        detail={row.ao100}
                                        isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao100'}
                                        onClick={handleRecordClick}
                                    />
                                    <RecordCell
                                        eventName={row.label}
                                        eventType={row.type}
                                        detail={row.ao250}
                                        isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao250'}
                                        onClick={handleRecordClick}
                                    />
                                    <RecordCell
                                        eventName={row.label}
                                        eventType={row.type}
                                        detail={row.ao1000}
                                        isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao1000'}
                                        onClick={handleRecordClick}
                                    />
                                </tr>
                            ))}

                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="px-4 py-10 text-center text-text-secondary italic">
                                        No solves found. Start solving to see your records!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footnote & Table Key */}
            {!hideFootnote && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-text-secondary px-1">
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-text-primary">*</span>
                        <span>The <strong>ao250</strong> and <strong>ao1000</strong> averages can span across sessions. Other averages must be within the same session.</span>
                    </div>

                    {/* Table Key (Color Legend) */}
                    <div className="flex items-center gap-3.5 text-[11px] font-mono shrink-0 self-start sm:self-auto">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] inline-block" />
                            <span className="text-text-secondary">Today</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            <span className="text-text-secondary">Last Week</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400/70 inline-block" />
                            <span className="text-text-secondary">Last Month</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Inspector Modal / Slide-over Drawer */}
            {selectedRecord && (
                <div
                    className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={() => setSelectedRecord(null)}
                >
                    <div onClick={(e) => e.stopPropagation()} className="h-full">
                        <RecordInspectorSidebar
                            eventName={selectedRecord.eventName}
                            record={selectedRecord.detail}
                            onClose={() => setSelectedRecord(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

interface RecordCellProps {
    eventName: string;
    eventType: string;
    detail: RecordDetail | null;
    isSelected: boolean;
    onClick: (eventName: string, eventType: string, detail: RecordDetail | null) => void;
}

function RecordCell({ eventName, eventType, detail, isSelected, onClick }: RecordCellProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState<{
        left: number;
        top: number;
        placement: 'top' | 'bottom';
        arrowOffset: number;
    } | null>(null);

    useEffect(() => {
        if (!isHovered) return;
        const handleScrollOrResize = () => {
            setIsHovered(false);
        };
        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);
        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isHovered]);

    if (!detail || detail.value === null) {
        return (
            <td className="px-3 py-2.5 text-right text-text-secondary/30 font-mono text-xs">
                -
            </td>
        );
    }

    const tier = getRecencyTier(detail.completedDate);
    const recencyClass = getRecencyClasses(tier);

    const formattedFirstSolveDate = detail.firstSolveDate
        ? format(new Date(detail.firstSolveDate), 'MMM d, yyyy, h:mm a')
        : null;

    const formattedCompletedDate = detail.completedDate
        ? format(new Date(detail.completedDate), 'MMM d, yyyy, h:mm a')
        : null;

    const updatePosition = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const buttonCenterX = rect.left + rect.width / 2;

        // Approximate half-width of tooltip (~110px). Clamp tooltip center X so it stays within viewport
        const minCenter = 120;
        const maxCenter = Math.max(minCenter, window.innerWidth - 120);
        const clampedCenterX = Math.max(minCenter, Math.min(maxCenter, buttonCenterX));

        // Offset of arrow from tooltip center
        const arrowOffset = Math.max(-80, Math.min(80, buttonCenterX - clampedCenterX));

        // Determine if tooltip should appear above or below
        const spaceAbove = rect.top;
        const placement: 'top' | 'bottom' = spaceAbove >= 110 ? 'top' : 'bottom';
        const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;

        setTooltipPos({
            left: clampedCenterX,
            top,
            placement,
            arrowOffset
        });
    };

    const handleMouseEnter = () => {
        updatePosition();
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    return (
        <td className="px-1.5 py-1 text-right relative">
            <button
                ref={buttonRef}
                type="button"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                    setIsHovered(false);
                    onClick(eventName, eventType, detail);
                }}
                className={`
                    w-full px-2.5 py-1.5 rounded-lg font-mono text-xs text-right transition-all cursor-pointer outline-none
                    ${recencyClass}
                    ${isSelected
                        ? 'bg-accent/15 ring-2 ring-accent shadow-sm'
                        : 'hover:bg-bg-hover hover:ring-1 hover:ring-border/80'
                    }
                `}
            >
                <span>{formatTime(detail.value)}</span>
            </button>

            {/* Portal Hover Tooltip */}
            {isHovered && tooltipPos && typeof document !== 'undefined' && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: `${tooltipPos.left}px`,
                        top: `${tooltipPos.top}px`,
                        transform: tooltipPos.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                        zIndex: 9999
                    }}
                    className="flex flex-col gap-1 bg-zinc-950 text-white text-[11px] px-3.5 py-2.5 rounded-xl border border-zinc-700 whitespace-nowrap shadow-2xl pointer-events-none min-w-[200px] text-left animate-in fade-in zoom-in-95"
                >
                    <div className="font-semibold text-white text-xs border-b border-zinc-800 pb-1 flex items-center justify-between gap-2">
                        <span>{eventName} {detail.label}</span>
                        <span className="font-mono text-amber-400 font-bold">{formatTime(detail.value)}</span>
                    </div>

                    <div className="flex flex-col gap-1 text-[10px] text-zinc-300 font-mono pt-0.5">
                        {formattedFirstSolveDate && (
                            <div className="flex flex-col">
                                <span className="text-zinc-400 font-sans text-[9px] uppercase tracking-wider">First Solve Date & Time:</span>
                                <span className="text-white font-medium">{formattedFirstSolveDate}</span>
                            </div>
                        )}
                        {detail.size > 1 && formattedCompletedDate && formattedCompletedDate !== formattedFirstSolveDate && (
                            <div className="flex flex-col pt-0.5 border-t border-zinc-800/60">
                                <span className="text-zinc-400 font-sans text-[9px] uppercase tracking-wider">Completed Date & Time:</span>
                                <span className="text-zinc-200">{formattedCompletedDate}</span>
                            </div>
                        )}
                    </div>

                    {/* Arrow */}
                    <div
                        className={`w-2 h-2 bg-zinc-950 border-zinc-700 absolute ${
                            tooltipPos.placement === 'top'
                                ? '-bottom-1 border-r border-b'
                                : '-top-1 border-l border-t'
                        }`}
                        style={{
                            left: `calc(50% + ${tooltipPos.arrowOffset}px)`,
                            transform: 'translateX(-50%) rotate(45deg)'
                        }}
                    />
                </div>,
                document.body
            )}
        </td>
    );
}

interface RecordInspectorSidebarProps {
    eventName: string;
    record: RecordDetail;
    onClose: () => void;
}

function RecordInspectorSidebar({
    eventName,
    record,
    onClose
}: RecordInspectorSidebarProps) {
    const [width, setWidth] = useState(380);
    const [expandedSolveId, setExpandedSolveId] = useState<string | null>(null);
    const [copiedAll, setCopiedAll] = useState(false);

    const tier = getRecencyTier(record.completedDate);
    const drops = getDropsCount(record.size);

    const toggleExpand = (id: string) => {
        setExpandedSolveId(prev => (prev === id ? null : id));
    };

    const handleCopyAll = () => {
        const text = record.solves.map((s, idx) => {
            const isDropped = record.droppedIndices.has(idx);
            let timeStr = formatTime(s.time + (s.penalty === '+2' ? 2000 : 0));
            if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') timeStr = 'DNF';
            else if (s.penalty === '+2') timeStr += '+';
            return `${idx + 1}. ${isDropped ? `(${timeStr})` : timeStr}   ${s.scramble}`;
        }).join('\n');

        const summaryHeader = `${eventName} - ${record.label}: ${formatTime(record.value)}\n` +
            `Solves: ${record.solves.length}\n` +
            `Date: ${record.completedDate ? format(new Date(record.completedDate), 'yyyy-MM-dd HH:mm') : ''}\n\n`;

        navigator.clipboard.writeText(summaryHeader + text);
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
    };

    return (
        <aside
            style={{ width }}
            className="h-full bg-bg-secondary border-l border-border flex flex-col text-text-secondary text-sm overflow-hidden select-none animate-in slide-in-from-right duration-250 shrink-0 relative z-30 font-sans shadow-2xl"
        >
            {/* Resize Handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-accent/50 transition-colors z-40"
                onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = width;

                    const onMouseMove = (ev: MouseEvent) => {
                        const newWidth = startWidth - (ev.clientX - startX);
                        setWidth(Math.max(320, Math.min(600, newWidth)));
                    };

                    const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    };

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                }}
            />

            {/* Top Section: Header & Detailed Record Summary */}
            <div className="flex flex-col border-b border-border bg-bg-secondary sticky top-0 z-20">
                {/* Title Bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg shrink-0">
                            <Trophy className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-text-primary truncate">
                                {eventName}
                            </span>
                            <span className="text-[11px] text-text-secondary font-mono">
                                {record.label} Record
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-bg-hover rounded-md text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        title="Close (Esc)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Big Record Time Display & Recency Banner */}
                <div className="px-4 py-4 flex flex-col items-center justify-center text-center bg-bg-primary/30 border-b border-border/40">
                    <div className={`text-4xl font-mono font-bold tracking-tight ${tier === 'today' ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]' : tier === 'last_week' ? 'text-emerald-500' : tier === 'last_month' ? 'text-emerald-400' : 'text-text-primary'}`}>
                        {formatTime(record.value)}
                    </div>

                    {/* Recency Badge */}
                    {tier === 'today' && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold font-mono uppercase tracking-wider">
                            <Flame className="w-3 h-3" />
                            Completed Today
                        </div>
                    )}
                    {tier === 'last_week' && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold font-mono uppercase tracking-wider">
                            <Sparkles className="w-3 h-3" />
                            Completed Last Week
                        </div>
                    )}
                    {tier === 'last_month' && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono uppercase tracking-wider">
                            <Calendar className="w-3 h-3" />
                            Completed Last Month
                        </div>
                    )}
                </div>

                {/* Detailed Stats Metrics Grid */}
                <div className="p-3.5 flex flex-col gap-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-bg-primary/40 border border-border/50 rounded-lg p-2 flex flex-col">
                            <span className="text-[10px] text-text-secondary uppercase font-semibold">First Solve</span>
                            <span className="text-text-primary font-mono text-[11px] mt-0.5 truncate">
                                {record.firstSolveDate ? format(new Date(record.firstSolveDate), 'MMM d, yyyy') : '-'}
                            </span>
                            <span className="text-text-secondary/70 font-mono text-[10px]">
                                {record.firstSolveDate ? format(new Date(record.firstSolveDate), 'h:mm a') : ''}
                            </span>
                        </div>

                        <div className="bg-bg-primary/40 border border-border/50 rounded-lg p-2 flex flex-col">
                            <span className="text-[10px] text-text-secondary uppercase font-semibold">Completed</span>
                            <span className="text-text-primary font-mono text-[11px] mt-0.5 truncate">
                                {record.completedDate ? format(new Date(record.completedDate), 'MMM d, yyyy') : '-'}
                            </span>
                            <span className="text-text-secondary/70 font-mono text-[10px]">
                                {record.completedDate ? format(new Date(record.completedDate), 'h:mm a') : ''}
                            </span>
                        </div>
                    </div>

                    {record.size > 1 && (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-bg-primary/40 border border-border/50 rounded-lg p-2 flex flex-col">
                                <span className="text-[9px] text-text-secondary uppercase font-semibold">Best</span>
                                <span className="text-text-primary font-mono font-bold mt-0.5">
                                    {formatTime(record.bestSolveTime)}
                                </span>
                            </div>
                            <div className="bg-bg-primary/40 border border-border/50 rounded-lg p-2 flex flex-col">
                                <span className="text-[9px] text-text-secondary uppercase font-semibold">Worst</span>
                                <span className="text-text-primary font-mono font-bold mt-0.5">
                                    {formatTime(record.worstSolveTime)}
                                </span>
                            </div>
                            <div className="bg-bg-primary/40 border border-border/50 rounded-lg p-2 flex flex-col">
                                <span className="text-[9px] text-text-secondary uppercase font-semibold">Std Dev</span>
                                <span className="text-text-primary font-mono font-bold mt-0.5">
                                    {record.std !== null ? `${(record.std / 1000).toFixed(2)}s` : '-'}
                                </span>
                            </div>
                        </div>
                    )}

                    {record.size > 1 && (
                        <div className="flex items-center justify-between text-[11px] text-text-secondary px-1 pt-1 border-t border-border/30">
                            <span>
                                Trimmed: <strong>{drops * 2} solves</strong> ({drops} best, {drops} worst)
                            </span>
                            <span className="font-mono">
                                {record.isCrossSession ? 'Cross-Session' : 'Same Session'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Solve List Header */}
            <div className="px-4 py-2 bg-bg-secondary/90 border-b border-border/50 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                    <Layers className="w-3.5 h-3.5 text-text-secondary" />
                    <span>Solves ({record.solves.length})</span>
                    <span className="text-[10px] text-text-secondary/70 font-normal ml-1">
                        ( ) = non-counting
                    </span>
                </div>

                <button
                    onClick={handleCopyAll}
                    className="flex items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-accent transition-colors cursor-pointer"
                    title="Copy record summary and all scrambles"
                >
                    {copiedAll ? (
                        <>
                            <Check className="w-3 h-3 text-green-500" />
                            <span className="text-green-500">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3 h-3" />
                            <span>Copy All</span>
                        </>
                    )}
                </button>
            </div>

            {/* Bottom Solves List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col divide-y divide-border/20">
                    {record.solves.map((solve, index) => {
                        const isNonCounting = record.droppedIndices.has(index);
                        const isExpanded = expandedSolveId === solve.id;

                        return (
                            <RecordSolveItem
                                key={solve.id || index}
                                solve={solve}
                                number={index + 1}
                                isNonCounting={isNonCounting}
                                isExpanded={isExpanded}
                                onToggle={() => toggleExpand(solve.id)}
                            />
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}

interface RecordSolveItemProps {
    solve: Solve;
    number: number;
    isNonCounting: boolean;
    isExpanded: boolean;
    onToggle: () => void;
}

function RecordSolveItem({
    solve,
    number,
    isNonCounting,
    isExpanded,
    onToggle
}: RecordSolveItemProps) {
    const [copiedScramble, setCopiedScramble] = useState(false);

    const formatSolveDisplay = (s: Solve) => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return 'DNF';
        let tVal = s.time;
        if (s.penalty === '+2') tVal += 2000;
        if (s.inspectionPenalty === '+2') tVal += 2000;

        let tStr = '';
        const totalSeconds = tVal / 1000;
        if (totalSeconds < 60) {
            tStr = tVal === 0 ? '0.00' : (tVal / 1000).toFixed(2);
        } else {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = (totalSeconds % 60).toFixed(2);
            tStr = `${minutes}:${seconds.padStart(5, '0')}`;
        }

        let plusCount = 0;
        if (s.penalty === '+2') plusCount++;
        if (s.inspectionPenalty === '+2') plusCount++;
        if (plusCount === 1) tStr += '+';
        if (plusCount === 2) tStr += '++';
        return tStr;
    };

    const displayTime = formatSolveDisplay(solve);

    const handleCopyScramble = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(solve.scramble);
        setCopiedScramble(true);
        setTimeout(() => setCopiedScramble(false), 2000);
    };

    return (
        <div
            onClick={onToggle}
            className={`flex flex-col border-l-2 transition-colors cursor-pointer text-sm
                ${isExpanded ? 'bg-bg-hover/30 border-accent' : 'border-transparent hover:bg-bg-hover/30'}
            `}
        >
            <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-text-secondary/40 font-mono w-6 text-right text-[11px] shrink-0">
                        {number}
                    </span>
                    <span
                        className={`font-mono font-medium ${
                            solve.penalty === 'DNF'
                                ? 'text-red-500'
                                : isNonCounting
                                    ? 'text-text-secondary/70'
                                    : 'text-text-primary'
                        }`}
                    >
                        {isNonCounting ? `(${displayTime})` : displayTime}
                    </span>
                    {isNonCounting && (
                        <span className="text-[10px] text-text-secondary/50 font-sans ml-1">
                            trimmed
                        </span>
                    )}
                </div>

                <div className="text-text-secondary/50 text-xs">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-3 pt-1 flex flex-col gap-2.5 animate-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between text-[11px] text-text-secondary">
                        <span>
                            {new Date(solve.date).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                            })}
                        </span>
                        {solve.inspectionTime !== undefined && (
                            <span className="font-mono text-[10px]">
                                Insp: {(solve.inspectionTime / 1000).toFixed(2)}s
                            </span>
                        )}
                    </div>

                    <div
                        onClick={handleCopyScramble}
                        className={`text-[11px] font-mono break-all leading-relaxed p-2 rounded-lg cursor-pointer transition-colors
                            ${copiedScramble ? 'text-green-500 bg-green-500/10 border border-green-500/30' : 'bg-zinc-100 text-zinc-900 border border-zinc-200 dark:border-transparent dark:bg-black/30 dark:text-text-secondary/80 hover:bg-zinc-200 dark:hover:bg-black/40'}`}
                        title="Click to copy scramble"
                    >
                        {copiedScramble ? 'Copied scramble to clipboard!' : solve.scramble}
                    </div>
                </div>
            )}
        </div>
    );
}
