import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { randomScrambleForEvent } from 'cubing/scramble';
import { useSettings } from '../contexts/SettingsContext';
import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import { useGoals } from '../contexts/GoalsContext';
import { useLive } from '../contexts/LiveContext';
import { Link } from 'react-router-dom';
import {
    EyeOff,
    Minus,
    Plus,
    Radio,
    Search,
    SkipForward,
    CheckCircle2
} from 'lucide-react';
import { formatTime } from '../utils/formatTime';
import type { LiveUser, TimerState } from '../types';
import { UserCard, KeybindTooltip } from '../components';

export default function Cube() {
    const { settings, updateSettings } = useSettings();
    const { solves, addSolve, updateSolve, currentScramble, setCurrentScramble } = useSolves();
    const { startNewSession, currentSessionId } = useSession();
    const { user, toggleStarUser } = useAuth();
    const { pinnedGoals } = useGoals();
    const { isLiveMode, setIsLiveMode, connectedUsers, setLiveTimerState } = useLive();

    const scrambleType = settings.scrambleType;

    // Last finished solve tracking for 5s penalty shortcuts
    const lastFinishedSolveRef = useRef<{ id: string; timestamp: number } | null>(null);
    const [penaltyFeedback, setPenaltyFeedback] = useState<{ text: string; type: string } | null>(null);

    // Live Mode State
    const [searchQuery, setSearchQuery] = useState('');
    const bottomContainerRef = useRef<HTMLDivElement>(null);
    const [isBottomOverflowing, setIsBottomOverflowing] = useState(false);

    // Session consistency
    const checkSessionConsistency = useCallback(async () => {
        if (!currentSessionId) return;
        const sessionSolves = solves.filter(s => s.sessionId === currentSessionId);
        if (sessionSolves.length === 0) return;

        const lastSolve = sessionSolves[0];
        const lastType = lastSolve.scrambleType || '333';
        if (lastType !== scrambleType) {
            await startNewSession(false);
        }
    }, [currentSessionId, solves, scrambleType, startNewSession]);

    useEffect(() => {
        checkSessionConsistency();
    }, [scrambleType, checkSessionConsistency]);

    useEffect(() => {
        if (user && !currentSessionId) {
            startNewSession(false);
        }
    }, [user, currentSessionId, startNewSession]);

    const [scramble, setScramble] = useState<string>(currentScramble || 'Generating scramble...');
    const [timerState, setTimerState] = useState<TimerState>('IDLE');
    const [time, setTime] = useState(0);
    const [inspectionTime, setInspectionTime] = useState(15);
    const [primingProgress, setPrimingProgress] = useState(0);
    const [scrambleVisible, setScrambleVisible] = useState(true);
    const [isCopied, setIsCopied] = useState(false);

    // Sync timerState with LiveContext for RTDB broadcast
    useEffect(() => {
        setLiveTimerState(timerState);
    }, [timerState, setLiveTimerState]);

    const startTimeRef = useRef<number>(0);
    const primingStartRef = useRef<number | null>(null);
    const initialPenaltyRef = useRef<Solve['penalty']>('none');
    const [prevTimerState, setPrevTimerState] = useState<TimerState>('IDLE');

    const inspectionStartTimeRef = useRef<number | null>(null);
    const inspectionUsedRef = useRef<number>(0);

    const [visualScrambleType, setVisualScrambleType] = useState(settings.scrambleType);

    useEffect(() => {
        if (currentScramble && currentScramble !== scramble) {
            setScramble(currentScramble);
        }
    }, [currentScramble, scramble]);

    useEffect(() => {
        setVisualScrambleType(settings.scrambleType);
    }, [scramble, settings.scrambleType]);

    // Filter connected users
    const { favoriteUsers, communityUsers } = useMemo(() => {
        if (!user) return { favoriteUsers: [], communityUsers: [] };
        const starred = user.following || user.starredUsers || [];
        const blocked = user.blockedUsers || [];
        const q = searchQuery.toLowerCase();

        const allowed = connectedUsers.filter(u => !blocked.includes(u.uid));
        const favs = allowed.filter(u => starred.includes(u.uid));
        const comms = allowed.filter(u => !starred.includes(u.uid));

        const filterFn = (u: LiveUser) => u.username.toLowerCase().includes(q);

        return {
            favoriteUsers: favs,
            communityUsers: comms.filter(filterFn)
        };
    }, [connectedUsers, user, searchQuery]);

    // Scramble generation
    const generateNewScramble = useCallback(async () => {
        try {
            const s = await randomScrambleForEvent(scrambleType);
            const scrambleStr = s.toString();
            setScramble(scrambleStr);
            setCurrentScramble(scrambleStr);
        } catch (e) {
            console.error(e);
            const fallback = "R U R' U'";
            setScramble(fallback);
            setCurrentScramble(fallback);
        }
    }, [setCurrentScramble, scrambleType]);

    // Initial scramble on mount if none saved
    const mountedRef = useRef(false);
    useEffect(() => {
        if (!mountedRef.current) {
            mountedRef.current = true;
            if (!currentScramble) {
                generateNewScramble();
            }
        }
    }, [currentScramble, generateNewScramble]);

    // Generate new scramble when scrambleType changes
    const prevScrambleTypeRef = useRef(scrambleType);
    useEffect(() => {
        if (prevScrambleTypeRef.current !== scrambleType) {
            prevScrambleTypeRef.current = scrambleType;
            generateNewScramble();
        }
    }, [scrambleType, generateNewScramble]);

    // Timer Loop
    useEffect(() => {
        let animationFrameId: number;

        const animate = () => {
            if (timerState === 'RUNNING') {
                const now = performance.now();
                setTime(now - startTimeRef.current);
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        if (timerState === 'RUNNING') {
            startTimeRef.current = performance.now();
            animationFrameId = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [timerState]);

    // Inspection Logic
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;

        const shouldRunInspection = timerState === 'INSPECTION' ||
            (timerState === 'PRIMING' && prevTimerState === 'INSPECTION');

        if (shouldRunInspection) {
            interval = setInterval(() => {
                if (inspectionStartTimeRef.current) {
                    const elapsed = (Date.now() - inspectionStartTimeRef.current) / 1000;
                    const remaining = Math.ceil(15 - elapsed);

                    setInspectionTime(prev => {
                        if (prev !== remaining) {
                            return remaining;
                        }
                        return prev;
                    });
                }
            }, 100);
        }

        return () => clearInterval(interval);
    }, [timerState]);

    // Priming Animation Loop
    useEffect(() => {
        let reqId: number;
        const updatePriming = () => {
            if (primingStartRef.current !== null) {
                const elapsed = (Date.now() - primingStartRef.current) / 1000;
                const progress = Math.min(elapsed / settings.primingLength, 1);
                setPrimingProgress(progress);
                if (progress < 1) {
                    reqId = requestAnimationFrame(updatePriming);
                }
            }
        };
        if (timerState === 'PRIMING') {
            reqId = requestAnimationFrame(updatePriming);
        }
        return () => cancelAnimationFrame(reqId);
    }, [timerState, settings.primingLength]);

    // Finish Solve
    const finishSolve = useCallback(() => {
        setTimerState('SOLVED');
        setPrimingProgress(0);

        let finalInspectionPenalty: 'none' | '+2' | 'DNF' = 'none';
        finalInspectionPenalty = initialPenaltyRef.current;

        const solveId = crypto.randomUUID();
        lastFinishedSolveRef.current = { id: solveId, timestamp: Date.now() };

        addSolve({
            id: solveId,
            time: time,
            scramble: scramble,
            date: new Date().toISOString(),
            penalty: 'none',
            inspectionTime: inspectionUsedRef.current || (15 - inspectionTime),
            inspectionPenalty: finalInspectionPenalty,
            scrambleType: scrambleType
        });

        generateNewScramble();
    }, [
        time,
        scramble,
        addSolve,
        generateNewScramble,
        inspectionTime,
        scrambleType
    ]);

    // Keyboard handlers
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) || target.isContentEditable)) {
            if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
        }

        if (e.code === 'Space') {
            e.preventDefault();
            if (document.activeElement && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
                document.activeElement.blur();
            }

            if (e.repeat) return;

            if (timerState === 'IDLE') {
                if (settings.solveInspection) {
                    setPrevTimerState(timerState);
                    setTimerState('INSPECTION');
                    setInspectionTime(15);
                    inspectionStartTimeRef.current = Date.now();
                } else {
                    setPrevTimerState(timerState);
                    primingStartRef.current = Date.now();
                    setTimerState('PRIMING');
                    setPrimingProgress(0);
                }
            } else if (timerState === 'INSPECTION') {
                initialPenaltyRef.current = 'none';
                if (inspectionStartTimeRef.current) {
                    const elapsed = Date.now() - inspectionStartTimeRef.current;
                    inspectionUsedRef.current = elapsed;
                }
                setPrevTimerState(timerState);
                primingStartRef.current = Date.now();
                setTimerState('PRIMING');
                setPrimingProgress(0);
            } else if (timerState === 'RUNNING') {
                finishSolve();
            } else if (timerState === 'SOLVED') {
                if (settings.solveInspection) {
                    setPrevTimerState(timerState);
                    setTimerState('INSPECTION');
                    setInspectionTime(15);
                    inspectionStartTimeRef.current = Date.now();
                } else {
                    setPrevTimerState(timerState);
                    primingStartRef.current = Date.now();
                    setTimerState('PRIMING');
                    setPrimingProgress(0);
                }
            }
            return;
        }

        if (timerState === 'RUNNING') {
            finishSolve();
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            setTimerState('IDLE');
            setTime(0);
            setInspectionTime(15);
            setPrimingProgress(0);
            primingStartRef.current = null;
            inspectionStartTimeRef.current = null;
            setPenaltyFeedback(null);
            return;
        }

        // Post-solve 5-second penalty shortcuts ('d' for DNF, 'f' for +2 fault)
        if (timerState === 'SOLVED' || timerState === 'IDLE') {
            const now = Date.now();
            if (lastFinishedSolveRef.current && (now - lastFinishedSolveRef.current.timestamp) <= 5000) {
                const finishedId = lastFinishedSolveRef.current.id;
                const targetSolve = solves.find(s => s.id === finishedId) || (solves[0]?.id === finishedId ? solves[0] : null);
                if (targetSolve) {
                    if (e.key === 'd' || e.key === 'D') {
                        e.preventDefault();
                        const newPenalty = targetSolve.penalty === 'DNF' ? 'none' : 'DNF';
                        updateSolve(targetSolve.id, { penalty: newPenalty });
                        setPenaltyFeedback({ type: newPenalty, text: newPenalty === 'DNF' ? 'DNF applied' : 'Penalty removed' });
                        setTimeout(() => setPenaltyFeedback(null), 2500);
                        return;
                    }
                    if (e.key === 'f' || e.key === 'F') {
                        e.preventDefault();
                        const newPenalty = targetSolve.penalty === '+2' ? 'none' : '+2';
                        updateSolve(targetSolve.id, { penalty: newPenalty });
                        setPenaltyFeedback({ type: newPenalty, text: newPenalty === '+2' ? '+2 (Fault) applied' : 'Penalty removed' });
                        setTimeout(() => setPenaltyFeedback(null), 2500);
                        return;
                    }
                }
            }

            // Scrambler Shortcuts
            if (e.key === '2') { updateSettings({ scrambleType: '222' }); return; }
            if (e.key === '3') { updateSettings({ scrambleType: '333' }); return; }
            if (e.key === '4') { updateSettings({ scrambleType: '444' }); return; }
            if (e.key === '5') { updateSettings({ scrambleType: '555' }); return; }
            if (e.key === '6') { updateSettings({ scrambleType: '666' }); return; }
            if (e.key === '7') { updateSettings({ scrambleType: '777' }); return; }
            if (e.key === '1') { updateSettings({ scrambleType: 'sq1' }); return; }
            if (e.key === 'c' || e.key === 'C') { updateSettings({ scrambleType: 'clock' }); return; }
            if (e.key === 'm' || e.key === 'M') { updateSettings({ scrambleType: 'minx' }); return; }
            if (e.key === 'p' || e.key === 'P') { updateSettings({ scrambleType: 'pyram' }); return; }
            if (e.key === 's' || e.key === 'S') { updateSettings({ scrambleType: 'skewb' }); return; }
        }
    }, [timerState, settings.solveInspection, finishSolve, solves, updateSolve, updateSettings]);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
        }

        if (e.code === 'Space') {
            e.preventDefault();
            if (timerState === 'PRIMING') {
                const elapsed = (Date.now() - (primingStartRef.current || 0)) / 1000;
                if (elapsed >= settings.primingLength) {
                    if (settings.solveInspection) {
                        if (inspectionTime <= 0) {
                            if (inspectionTime > -2) {
                                initialPenaltyRef.current = '+2';
                            } else {
                                initialPenaltyRef.current = 'DNF';
                            }
                        } else {
                            initialPenaltyRef.current = 'none';
                        }
                    }

                    setTimerState('RUNNING');
                } else {
                    primingStartRef.current = null;
                    setPrimingProgress(0);
                    if (settings.solveInspection) {
                        setTimerState('INSPECTION');
                    } else {
                        setTimerState('IDLE');
                    }
                }
            }
        }
    }, [timerState, settings.primingLength, settings.solveInspection, inspectionTime]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

    // Helpers
    const getInspectionColor = () => {
        if (inspectionTime > 7) return 'text-text-primary';
        if (inspectionTime > 3) return 'text-orange-500';
        return 'text-red-500';
    };

    const handleCopyScramble = () => {
        navigator.clipboard.writeText(scramble);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const changeScrambleSize = (delta: number) => {
        updateSettings({ scrambleSize: Math.max(0.8, Math.min(3, settings.scrambleSize + delta)) });
    };

    const getScrambleSizeMultiplier = () => {
        switch (visualScrambleType) {
            case '444':
            case '555':
            case '444bf':
            case '555bf':
            case 'sq1':
                return 0.7;
            case '666':
            case '777':
            case 'minx':
                return 0.5;
            default:
                return 1;
        }
    };

    // Overflow tracking for community chips at the bottom
    useEffect(() => {
        const check = () => {
            if (bottomContainerRef.current) {
                const { scrollWidth, clientWidth } = bottomContainerRef.current;
                setIsBottomOverflowing(scrollWidth > clientWidth);
            }
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [communityUsers]);

    const formatRunningTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return seconds.toString();
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full relative overflow-hidden">

            {/* LIVE BAR (Top - Followed Cubers) */}
            {isLiveMode && favoriteUsers.length > 0 && (
                <div className="flex-shrink-0 p-4 flex justify-center items-center gap-4 overflow-x-auto h-40 animate-in slide-in-from-top-4 fade-in duration-300 z-10">
                    {favoriteUsers.map(u => (
                        <UserCard
                            key={u.uid}
                            user={u}
                        />
                    ))}
                </div>
            )}

            {/* MAIN TIMER STAGE */}
            <div
                className="flex-1 flex flex-col items-center justify-center select-none min-h-0 relative z-10"
                style={{ opacity: (timerState === 'PRIMING' && primingProgress < 1) ? 0.6 : 1 }}
            >
                {/* PINNED GOALS BANNER (Always Rendered & Interactive) */}
                {user && pinnedGoals.length > 0 && (
                    <div className="mb-4 w-full max-w-lg px-2 opacity-65 hover:opacity-100 transition-opacity animate-in fade-in duration-200 overflow-visible">
                        <div className="flex items-center justify-center gap-2 flex-wrap overflow-visible">
                            {pinnedGoals.map(goal => (
                                <div key={goal.goalId} className="relative group/goal flex-1 min-w-[120px] max-w-[170px] overflow-visible">
                                    <Link
                                        to="/goals"
                                        className="w-full bg-transparent border border-border/40 hover:border-border/80 rounded-lg px-2.5 py-1.5 flex flex-col gap-1 transition-colors cursor-pointer block"
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-[11px] font-medium text-text-secondary group-hover/goal:text-text-primary truncate">
                                                {goal.title}
                                            </span>
                                            {goal.completed ? (
                                                <CheckCircle2 className="w-3 h-3 text-text-secondary shrink-0" />
                                            ) : (
                                                <span className="text-[9px] font-mono text-text-secondary/70">
                                                    {goal.percentCompleted}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-full h-1 bg-text-secondary/15 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-text-secondary transition-all duration-300 rounded-full"
                                                style={{ width: `${goal.percentCompleted}%` }}
                                            />
                                        </div>
                                    </Link>

                                    {/* Hover Tooltip: Solid Popover showing what the goal is */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/goal:flex flex-col gap-1 bg-zinc-950 text-white text-[11px] p-2.5 rounded-lg border border-zinc-700 whitespace-normal w-56 z-[999] shadow-2xl pointer-events-none text-left animate-in fade-in zoom-in-95">
                                        <div className="font-semibold text-white text-xs flex items-center justify-between gap-2 border-b border-zinc-800 pb-1">
                                            <span className="truncate">{goal.title}</span>
                                            <span className={`text-[10px] font-mono shrink-0 ${goal.completed ? 'text-green-400' : 'text-zinc-400'}`}>
                                                {goal.completed ? 'Completed' : `${goal.percentCompleted}%`}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-zinc-300 leading-snug">
                                            {goal.description}
                                        </p>
                                        <div className="text-[10px] font-mono text-zinc-400 pt-0.5 flex items-center justify-between border-t border-zinc-800/60">
                                            <span>Progress:</span>
                                            <span className="text-zinc-200">{goal.displayCurrent} / {goal.displayTarget}</span>
                                        </div>
                                        <div className="w-2 h-2 bg-zinc-950 border-r border-b border-zinc-700 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Scramble Toolbar & Content */}
                {scrambleVisible ? (
                    <>
                        <div className="flex items-center gap-6 mb-4 text-text-secondary transition-opacity hover:text-text-primary">
                            {user && user.emailVerified && (
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={() => setIsLiveMode(!isLiveMode)}
                                        className={`flex items-center gap-1 transition-colors ${isLiveMode ? 'text-red-500 hover:text-red-400' : 'hover:text-accent'}`}
                                        title={isLiveMode ? "Disable Live Mode" : "Enable Live Mode"}
                                    >
                                        <Radio className={`w-5 h-5 ${isLiveMode ? 'animate-pulse' : ''}`} />
                                        {isLiveMode && <span className="text-xs font-bold uppercase tracking-widest">LIVE</span>}
                                    </button>
                                    <div className="w-[1px] h-5 bg-border/50" />
                                </div>
                            )}



                            <button onClick={() => setScrambleVisible(false)} className="hover:text-accent transition-colors cursor-pointer" title="Hide Scramble">
                                <EyeOff className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-4">
                                <button onClick={() => changeScrambleSize(-0.4)} className="hover:text-accent transition-colors cursor-pointer" title="Smaller">
                                    <Minus className="w-5 h-5" />
                                </button>
                                <button onClick={() => changeScrambleSize(0.4)} className="hover:text-accent transition-colors cursor-pointer" title="Larger">
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            <button
                                onClick={generateNewScramble}
                                className="hover:text-accent transition-colors cursor-pointer"
                                title="Skip Scramble"
                            >
                                <SkipForward className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scramble Text */}
                        <div className="mb-8 text-center max-w-2xl min-h-[4rem] flex flex-col items-center justify-center relative">
                            {isCopied && (
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-white text-[11px] font-medium px-2.5 py-0.5 rounded shadow-lg animate-in fade-in zoom-in-95 pointer-events-none whitespace-nowrap z-20 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                                    <span>Scramble copied!</span>
                                </div>
                            )}
                            <p
                                onClick={handleCopyScramble}
                                className="font-mono text-text-secondary leading-relaxed text-center cursor-pointer hover:text-text-primary active:scale-95"
                                style={{
                                    fontSize: `${settings.scrambleSize * getScrambleSizeMultiplier()}rem`,
                                    color: isCopied ? '#22c55e' : undefined
                                }}
                                title="Click to copy"
                            >
                                {scramble}
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="mb-8 min-h-[4rem] flex items-center justify-center">
                        <button
                            onClick={() => setScrambleVisible(true)}
                            className="font-mono text-text-secondary/50 italic hover:text-text-primary transition-colors cursor-pointer"
                        >
                            Scramble hidden
                        </button>
                    </div>
                )}

                {/* BIG TIMER DISPLAY */}
                <div className="text-center">
                    {timerState === 'INSPECTION' ? (
                        <h1 className={`text-9xl font-normal font-mono ${getInspectionColor()}`}>
                            {Math.abs(inspectionTime)}
                        </h1>
                    ) : timerState === 'RUNNING' ? (
                        settings.showLiveTimer ? (
                            <h1 className="text-9xl font-normal font-mono text-text-primary">
                                {formatRunningTime(time)}
                            </h1>
                        ) : (
                            <h1 className="text-9xl font-normal font-mono text-text-primary tracking-widest">
                                SOLVE
                            </h1>
                        )
                    ) : timerState === 'PRIMING' ? (
                        primingProgress >= 1 ? (
                            <h1 className="text-9xl font-normal font-mono text-green-500">
                                Ready
                            </h1>
                        ) : (
                            prevTimerState === 'INSPECTION' ? (
                                <h1 className={`text-9xl font-normal font-mono ${getInspectionColor()}`}>
                                    {Math.abs(inspectionTime)}
                                </h1>
                            ) : (
                                <h1 className={`text-9xl font-normal font-mono text-text-primary ${primingProgress < 1 ? 'opacity-50' : ''}`}>
                                    {formatTime(time)}
                                </h1>
                            )
                        )
                    ) : (
                        <h1 className="text-9xl font-normal font-mono text-text-primary">
                            {formatTime(time)}
                        </h1>
                    )}
                    {penaltyFeedback && (
                        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-accent/15 border border-accent/30 text-accent rounded-full text-xs font-bold font-mono animate-in fade-in zoom-in-95">
                            {penaltyFeedback.text}
                        </div>
                    )}
                </div>
            </div>

            {/* LIVE BAR (Bottom - Non-Following Active Cubers) */}
            {isLiveMode && (
                <div className="flex-shrink-0 w-full pb-3 pt-1 px-4 z-10 flex flex-col items-center justify-end">
                    {/* Subtle Search Input - only visible if there are enough bottom chips to justify scrolling, or search is active */}
                    {(isBottomOverflowing || searchQuery.length > 0) && (
                        <div className="flex items-center justify-center mb-2 animate-in fade-in duration-200">
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-secondary/30 hover:bg-bg-secondary/60 focus-within:bg-bg-secondary/80 transition-colors">
                                <Search className="w-3 h-3 text-text-secondary/50" />
                                <input
                                    type="text"
                                    placeholder="Search active cubers..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="bg-transparent text-xs text-text-primary focus:outline-none placeholder:text-text-secondary/40 w-36 focus:w-52 transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Chips Container */}
                    <div
                        ref={bottomContainerRef}
                        className="w-full overflow-hidden flex items-center justify-center min-h-[32px]"
                    >
                        {communityUsers.length === 0 ? (
                            searchQuery ? (
                                <div className="text-text-secondary/50 text-xs italic text-center py-1">
                                    No cubers matching &quot;{searchQuery}&quot;
                                </div>
                            ) : null
                        ) : isBottomOverflowing ? (
                            <div className="animate-marquee-slow flex items-center gap-2 py-0.5">
                                {[...communityUsers, ...communityUsers].map((u, idx) => (
                                    <button
                                        key={`${u.uid}-${idx}`}
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleStarUser(u.uid);
                                        }}
                                        className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 hover:border-border bg-bg-secondary/30 hover:bg-bg-secondary text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer group select-none shadow-2xs outline-none focus:outline-none"
                                        title={`Follow ${u.username}`}
                                    >
                                        <div
                                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0 transition-transform group-hover:scale-110 shadow-2xs"
                                            style={{ backgroundColor: u.color }}
                                        />
                                        <span className="font-medium truncate max-w-[120px]">{u.username}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-wrap justify-center items-center gap-2 py-0.5 max-w-full">
                                {communityUsers.map(u => (
                                    <button
                                        key={u.uid}
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleStarUser(u.uid);
                                        }}
                                        className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 hover:border-border bg-bg-secondary/30 hover:bg-bg-secondary text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer group select-none shadow-2xs outline-none focus:outline-none"
                                        title={`Follow ${u.username}`}
                                    >
                                        <div
                                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0 transition-transform group-hover:scale-110 shadow-2xs"
                                            style={{ backgroundColor: u.color }}
                                        />
                                        <span className="font-medium truncate max-w-[120px]">{u.username}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* KEYBIND & POWER-USER FEATURE TOOLTIPS */}
            <KeybindTooltip timerState={timerState} totalSolves={solves.length} />
        </div>
    );
}
