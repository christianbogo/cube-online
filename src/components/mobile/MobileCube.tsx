import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { randomScrambleForEvent } from 'cubing/scramble';
import {
    Menu,
    SlidersHorizontal,
    X,
    Box,
    BarChart2,
    Target,
    Users,
    User,
    Lock,
    Minus,
    Plus,
    ChevronRight,
    Copy,
    Check,
    Ghost,
    Sun,
    Moon,
    Monitor,
    ShieldCheck
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useSolves, type Solve } from '../../contexts/SolvesContext';
import { useSession } from '../../contexts/SessionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLive } from '../../contexts/LiveContext';
import { useTheme } from '../ui/ThemeProvider';
import { UserAvatar, WcaBadge } from '../ui/UserAvatar';
import { hasLinkedWca } from '../../utils/wca';
import { useEvents } from '../../hooks/useEvents';
import { formatTime } from '../../utils/formatTime';
import { MOCK_FRIENDS, USE_MOCK_USERS } from '../../utils/mockLiveUsers';
import type { TimerState } from '../../types';
import { UserCard } from '../ui/UserCard';
import CreateEventModal from '../timer/CreateEventModal';

export default function MobileCube() {
    const navigate = useNavigate();
    const { settings, updateSettings } = useSettings();
    const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
    const { solves, addSolve, updateSolve, currentScramble, setCurrentScramble } = useSolves();
    const { currentSessionId, setCurrentSessionId, checkSessionStatus } = useSession();
    const { user } = useAuth();
    const { isLiveMode, isGhostMode, toggleGhostMode, connectedUsers, setLiveTimerState } = useLive();
    const { theme, setTheme } = useTheme();
    const { allEvents, getBaseScrambleType } = useEvents();

    const scrambleType = settings.scrambleType;

    // Full screen overlay states
    const [isNavOpen, setIsNavOpen] = useState(false);
    const [isToolsOpen, setIsToolsOpen] = useState(false);

    // Timer States
    const scramble = currentScramble || 'Generating scramble...';
    const isNoScramble = getBaseScrambleType(scrambleType) === 'none' || scramble === 'No Scramble';
    const [timerState, setTimerState] = useState<TimerState>('IDLE');
    const [time, setTime] = useState(0);
    const [inspectionTime, setInspectionTime] = useState(15);
    const [primingProgress, setPrimingProgress] = useState(0);
    const [scrambleVisible, setScrambleVisible] = useState(true);
    const [isCopied, setIsCopied] = useState(false);

    // Penalty feedback
    const lastFinishedSolveRef = useRef<{ id: string; timestamp: number } | null>(null);
    const [penaltyFeedback, setPenaltyFeedback] = useState<{ text: string; type: string } | null>(null);

    const startTimeRef = useRef<number>(0);
    const timerStateRef = useRef<TimerState>('IDLE');
    const primingStartRef = useRef<number | null>(null);
    const initialPenaltyRef = useRef<Solve['penalty']>('none');
    const [prevTimerState, setPrevTimerState] = useState<TimerState>('IDLE');
    const prevTimerStateRef = useRef<TimerState>('IDLE');
    const inspectionStartTimeRef = useRef<number | null>(null);
    const inspectionUsedRef = useRef<number>(0);
    const touchPrimingIntervalRef = useRef<number | null>(null);

    // Sync timerState with LiveContext for RTDB broadcast
    useEffect(() => {
        setLiveTimerState(timerState);
        timerStateRef.current = timerState;
    }, [timerState, setLiveTimerState]);

    // Ensure theme-color meta tag matches --bg-primary on mobile Cube page
    useEffect(() => {
        const root = document.documentElement;
        const isDark = root.classList.contains('dark') || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const mobileBgColor = isDark ? '#0d1117' : '#ffffff';

        const metaTags = document.querySelectorAll('meta[name="theme-color"]');
        const originalColors: string[] = [];
        metaTags.forEach((el, idx) => {
            originalColors[idx] = el.getAttribute('content') || '';
            el.setAttribute('content', mobileBgColor);
        });

        return () => {
            // Restore original on unmount (leaving mobile cube)
            metaTags.forEach((el, idx) => {
                if (originalColors[idx]) {
                    el.setAttribute('content', originalColors[idx]);
                }
            });
        };
    }, [theme]);

    // Session consistency
    const checkSessionConsistency = useCallback(() => {
        const targetScrambleType = scrambleType || '333';
        const eventSolves = solves.filter(s =>
            (!user || s.userId === user.uid) &&
            (s.scrambleType || '333') === targetScrambleType
        );

        if (eventSolves.length > 0) {
            const lastSolve = eventSolves[0];
            const lastSolveTime = new Date(lastSolve.date).getTime();
            const { isNewSessionNeeded } = checkSessionStatus(lastSolveTime);

            if (!isNewSessionNeeded && lastSolve.sessionId) {
                if (currentSessionId !== lastSolve.sessionId) {
                    setCurrentSessionId(lastSolve.sessionId);
                }
                return;
            }
        }

        if (currentSessionId) {
            const currentSessionSolves = solves.filter(s => s.sessionId === currentSessionId);
            if (currentSessionSolves.length > 0) {
                const sessionScrambleType = currentSessionSolves[0].scrambleType || '333';
                const lastSessionSolveTime = new Date(currentSessionSolves[0].date).getTime();
                const { isNewSessionNeeded } = checkSessionStatus(lastSessionSolveTime);

                if (sessionScrambleType !== targetScrambleType || isNewSessionNeeded) {
                    setCurrentSessionId(null);
                }
            }
        }
    }, [currentSessionId, solves, scrambleType, user, checkSessionStatus, setCurrentSessionId]);

    useEffect(() => {
        checkSessionConsistency();
    }, [scrambleType, checkSessionConsistency]);

    // Scramble generation
    const generateNewScramble = useCallback(async () => {
        try {
            const baseScrambleType = getBaseScrambleType(scrambleType);
            if (baseScrambleType === 'none') {
                setCurrentScramble('No Scramble');
                return;
            }
            const s = await randomScrambleForEvent(baseScrambleType);
            setCurrentScramble(s.toString());
        } catch (e) {
            console.error(e);
            setCurrentScramble("R U R' U'");
        }
    }, [setCurrentScramble, scrambleType, getBaseScrambleType]);

    // Initial scramble on mount
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
            if (timerStateRef.current === 'RUNNING') {
                const now = performance.now();
                setTime(now - startTimeRef.current);
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        if (timerState === 'RUNNING') {
            timerStateRef.current = 'RUNNING';
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
            (timerState === 'PRIMING' && prevTimerStateRef.current === 'INSPECTION');

        if (shouldRunInspection) {
            interval = setInterval(() => {
                if (inspectionStartTimeRef.current) {
                    const elapsed = (Date.now() - inspectionStartTimeRef.current) / 1000;
                    const remaining = Math.ceil(15 - elapsed);
                    setInspectionTime(remaining);
                }
            }, 100);
        }

        return () => clearInterval(interval);
    }, [timerState]);

    // Finish Solve
    const finishSolve = useCallback(() => {
        const finalTime = startTimeRef.current ? (performance.now() - startTimeRef.current) : time;
        timerStateRef.current = 'SOLVED';
        setTime(finalTime);
        setTimerState('SOLVED');
        setPrimingProgress(0);

        let finalInspectionPenalty: 'none' | '+2' | 'DNF' = 'none';
        finalInspectionPenalty = initialPenaltyRef.current;

        const solveId = crypto.randomUUID();
        lastFinishedSolveRef.current = { id: solveId, timestamp: Date.now() };

        addSolve({
            id: solveId,
            time: finalTime,
            scramble: scramble,
            date: new Date().toISOString(),
            penalty: 'none',
            inspectionTime: inspectionUsedRef.current || (15 - inspectionTime),
            inspectionPenalty: finalInspectionPenalty,
            scrambleType: scrambleType
        });

        generateNewScramble();
    }, [time, scramble, addSolve, generateNewScramble, inspectionTime, scrambleType]);

    // Touch / Pointer Timer Control
    const isHoldingRef = useRef(false);

    const startPrimingAnimation = useCallback(() => {
        primingStartRef.current = Date.now();
        setPrimingProgress(0);

        if (touchPrimingIntervalRef.current) {
            cancelAnimationFrame(touchPrimingIntervalRef.current);
        }

        const update = () => {
            if (primingStartRef.current !== null && isHoldingRef.current) {
                const elapsed = (Date.now() - primingStartRef.current) / 1000;
                const progress = Math.min(elapsed / settings.primingLength, 1);
                setPrimingProgress(progress);
                if (progress < 1) {
                    touchPrimingIntervalRef.current = requestAnimationFrame(update);
                }
            }
        };
        touchPrimingIntervalRef.current = requestAnimationFrame(update);
    }, [settings.primingLength]);

    const handlePointerDown = (e: React.PointerEvent) => {
        // If a modal is active, or if touching interactive elements, ignore
        if (isNavOpen || isToolsOpen) {
            return;
        }

        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, [role="button"]')) {
            return;
        }

        e.preventDefault();

        // 1. If RUNNING: immediately STOP
        if (timerStateRef.current === 'RUNNING') {
            finishSolve();
            return;
        }

        // 2. If IDLE or SOLVED:
        if (timerStateRef.current === 'IDLE' || timerStateRef.current === 'SOLVED') {
            if (settings.solveInspection) {
                // Enter inspection
                setPrevTimerState(timerStateRef.current);
                prevTimerStateRef.current = timerStateRef.current;
                setTimerState('INSPECTION');
                setInspectionTime(15);
                inspectionStartTimeRef.current = Date.now();
                return;
            } else {
                // Start priming
                isHoldingRef.current = true;
                setPrevTimerState(timerStateRef.current);
                prevTimerStateRef.current = timerStateRef.current;
                setTimerState('PRIMING');
                startPrimingAnimation();
                return;
            }
        }

        // 3. If in INSPECTION:
        if (timerStateRef.current === 'INSPECTION') {
            initialPenaltyRef.current = 'none';
            if (inspectionStartTimeRef.current) {
                inspectionUsedRef.current = Date.now() - inspectionStartTimeRef.current;
            }
            isHoldingRef.current = true;
            setPrevTimerState('INSPECTION');
            prevTimerStateRef.current = 'INSPECTION';
            setTimerState('PRIMING');
            startPrimingAnimation();
            return;
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isNavOpen || isToolsOpen) return;
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select, [role="button"]')) {
            return;
        }

        e.preventDefault();

        if (timerStateRef.current === 'PRIMING') {
            isHoldingRef.current = false;
            if (touchPrimingIntervalRef.current) {
                cancelAnimationFrame(touchPrimingIntervalRef.current);
            }

            const elapsed = (Date.now() - (primingStartRef.current || 0)) / 1000;
            if (elapsed >= settings.primingLength) {
                // Priming completed -> START TIMER
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
                // Released too early -> Cancel priming
                primingStartRef.current = null;
                setPrimingProgress(0);
                if (prevTimerStateRef.current === 'INSPECTION') {
                    setTimerState('INSPECTION');
                } else {
                    setTimerState('IDLE');
                }
            }
        }
    };

    const handlePointerCancel = () => {
        if (timerStateRef.current === 'PRIMING') {
            isHoldingRef.current = false;
            primingStartRef.current = null;
            setPrimingProgress(0);
            if (prevTimerStateRef.current === 'INSPECTION') {
                setTimerState('INSPECTION');
            } else {
                setTimerState('IDLE');
            }
        }
    };

    // Live Users Filtering (Followed users only)
    const favoriteUsers = useMemo(() => {
        const starred = user?.following || user?.starredUsers || [];
        const blocked = user?.blockedUsers || [];

        const allowed = connectedUsers.filter(u => !blocked.includes(u.uid));
        const liveFavs = allowed.filter(u => starred.includes(u.uid));

        const mockFavs = USE_MOCK_USERS ? MOCK_FRIENDS : [];

        return [...mockFavs, ...liveFavs].filter(u => !blocked.includes(u.uid));
    }, [connectedUsers, user]);

    // Inspection color helper
    const getInspectionColor = () => {
        if (inspectionTime > 7) return 'text-text-primary';
        if (inspectionTime > 3) return 'text-orange-500';
        return 'text-red-500';
    };

    const formatRunningTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return seconds.toString();
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleCopyScramble = () => {
        navigator.clipboard.writeText(scramble);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // 5-second post solve penalties
    const applyPenalty = (type: '+2' | 'DNF') => {
        if (lastFinishedSolveRef.current) {
            const finishedId = lastFinishedSolveRef.current.id;
            const target = solves.find(s => s.id === finishedId) || solves[0];
            if (target) {
                const newPenalty = target.penalty === type ? 'none' : type;
                updateSolve(target.id, { penalty: newPenalty });
                setPenaltyFeedback({
                    type: newPenalty,
                    text: newPenalty === 'none' ? 'Penalty removed' : `${newPenalty} applied`
                });
                setTimeout(() => setPenaltyFeedback(null), 2500);
            }
        }
    };

    return (
        <div
            className="w-full h-full relative overflow-hidden select-none touch-none bg-bg-primary text-text-primary flex flex-col justify-between"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            style={{ overscrollBehavior: 'none' }}
        >
            {/* TOP BAR: Nav Button (Left), Timer Tools Button (Right) */}
            <div
                className="w-full flex items-center justify-between px-3.5 pt-[calc(env(safe-area-inset-top,0px)+0.85rem)] pb-1.5 z-30 shrink-0 select-none relative"
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* Top Left: Full Screen Nav Button (slightly rounded square) */}
                <button
                    type="button"
                    onClick={() => setIsNavOpen(true)}
                    className="w-9 h-9 rounded-lg bg-bg-secondary/80 hover:bg-bg-secondary border border-border/50 flex items-center justify-center text-text-secondary hover:text-text-primary transition-all active:scale-90 shadow-sm cursor-pointer shrink-0"
                    title="Open Navigation"
                    aria-label="Open Navigation"
                >
                    <Menu className="w-5 h-5" />
                </button>

                <div className="flex-1" />

                {/* Top Right: Full Screen Timer Tools Button (slightly rounded square) */}
                <button
                    type="button"
                    onClick={() => setIsToolsOpen(true)}
                    className="w-9 h-9 rounded-lg bg-bg-secondary/80 hover:bg-bg-secondary border border-border/50 flex items-center justify-center text-text-secondary hover:text-text-primary transition-all active:scale-90 shadow-sm cursor-pointer shrink-0"
                    title="Timer Tools & Scramble Settings"
                    aria-label="Timer Tools & Scramble Settings"
                >
                    <SlidersHorizontal className="w-5 h-5" />
                </button>
            </div>

            {/* LIVE BAR (Top - Followed Cubers Cards, Desktop-style) */}
            {isLiveMode && favoriteUsers.length > 0 && (
                <div
                    className="w-full flex-shrink-0 px-2 pt-0.5 pb-2 flex flex-col items-center z-20 animate-in slide-in-from-top-2 fade-in duration-200"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="w-full flex items-center overflow-x-auto min-h-[88px] py-1 px-4 no-scrollbar mask-fade-edges-cards touch-pan-x">
                        <div className="flex items-center gap-3 min-w-max mx-auto px-4 justify-center">
                            {favoriteUsers.map(u => (
                                <UserCard
                                    key={u.uid}
                                    user={u}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN TIMER BODY: Scramble + Time / Solve Text */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10 select-none pointer-events-none">
                {/* Scramble Display */}
                {scrambleVisible && (
                    <div className="w-full max-w-sm mb-6 flex flex-col items-center justify-center relative min-h-[4rem]">
                        {!isNoScramble && (
                            <p
                                className="font-mono text-text-secondary text-center leading-relaxed tracking-wide transition-colors"
                                style={{ fontSize: `${settings.scrambleSize * 0.75}rem` }}
                            >
                                {scramble}
                            </p>
                        )}
                    </div>
                )}

                {/* Centered Timer / Solve Display (Fitted for small screens) */}
                <div className="text-center select-none w-full px-2">
                    {timerState === 'INSPECTION' ? (
                        <h1 className={`text-6xl sm:text-7xl font-normal font-mono transition-colors tracking-tight ${getInspectionColor()}`}>
                            {Math.abs(inspectionTime)}
                        </h1>
                    ) : timerState === 'RUNNING' ? (
                        settings.showLiveTimer ? (
                            <h1 className="text-6xl sm:text-7xl font-normal font-mono text-text-primary tracking-tight">
                                {formatRunningTime(time)}
                            </h1>
                        ) : (
                            <h1 className="text-6xl sm:text-7xl font-normal font-mono text-text-primary tracking-widest">
                                SOLVE
                            </h1>
                        )
                    ) : timerState === 'PRIMING' ? (
                        primingProgress >= 1 ? (
                            <h1 className="text-6xl sm:text-7xl font-normal font-mono text-green-500 animate-pulse tracking-tight">
                                Ready
                            </h1>
                        ) : (
                            prevTimerState === 'INSPECTION' ? (
                                <h1 className={`text-6xl sm:text-7xl font-normal font-mono tracking-tight ${getInspectionColor()}`}>
                                    {Math.abs(inspectionTime)}
                                </h1>
                            ) : (
                                <h1 className="text-6xl sm:text-7xl font-normal font-mono text-text-primary opacity-40 tracking-tight">
                                    {formatTime(time)}
                                </h1>
                            )
                        )
                    ) : (
                        <h1 className="text-6xl sm:text-7xl font-normal font-mono text-text-primary tracking-tight">
                            {formatTime(time)}
                        </h1>
                    )}

                    {/* Post-Solve Penalty Indicator */}
                    {penaltyFeedback && (
                        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-accent/15 border border-accent/30 text-accent rounded-lg text-xs font-bold font-mono animate-in fade-in zoom-in-95">
                            {penaltyFeedback.text}
                        </div>
                    )}
                </div>

                {/* Subtle Prompt for new users */}
                {timerState === 'IDLE' && time === 0 && (
                    <p className="mt-8 text-xs text-text-secondary/50 font-medium">
                        {settings.solveInspection ? 'Tap screen to inspect' : 'Hold screen to start'}
                    </p>
                )}
            </div>

            {/* BOTTOM SECTION: Quick Penalty Buttons (+2, DNF) */}
            <div
                className="w-full px-3 pb-safe pb-3 z-20 shrink-0 flex flex-col items-center"
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* 5-second Quick Penalty Buttons (Visible after solve) */}
                {timerState === 'SOLVED' && (
                    <div className="mb-1 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <button
                            type="button"
                            onClick={() => applyPenalty('+2')}
                            className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-bg-secondary/90 hover:bg-bg-secondary border border-border text-text-secondary hover:text-text-primary active:scale-95 cursor-pointer shadow-xs"
                        >
                            +2
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPenalty('DNF')}
                            className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-bg-secondary/90 hover:bg-bg-secondary border border-border text-text-secondary hover:text-red-400 active:scale-95 cursor-pointer shadow-xs"
                        >
                            DNF
                        </button>
                    </div>
                )}
            </div>

            {/* FULL SCREEN NAVIGATION MODAL */}
            {isNavOpen && (
                <div
                    className="fixed inset-0 z-50 bg-bg-primary/98 backdrop-blur-lg flex flex-col pt-safe pb-safe px-6 select-none animate-in fade-in duration-200"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between py-4 border-b border-border/40 shrink-0">
                        <div className="flex items-center gap-2.5">
                            <Box className="w-6 h-6 text-accent" />
                            <span className="text-lg font-bold tracking-tight text-text-primary">Cube Online</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsNavOpen(false)}
                            className="w-9 h-9 rounded-lg bg-bg-secondary border border-border/60 flex items-center justify-center text-text-secondary hover:text-text-primary active:scale-95 cursor-pointer"
                            aria-label="Close navigation"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation Items (Cube, Logs, Goals, Social) - less rounded (rounded-lg) */}
                    <div className="flex-1 py-6 flex flex-col gap-3 justify-center">
                        <NavLink
                            to="/"
                            onClick={() => setIsNavOpen(false)}
                            className="flex items-center gap-4 p-4 rounded-lg bg-accent/15 text-accent font-semibold text-lg border border-accent/30 transition-all active:scale-98"
                        >
                            <Box className="w-6 h-6 shrink-0" />
                            <span className="flex-1">Cube Timer</span>
                            <span className="text-xs uppercase tracking-wider font-bold bg-accent/20 px-2 py-0.5 rounded-md">Active</span>
                        </NavLink>

                        <NavLink
                            to={user ? "/logs" : "#"}
                            onClick={(e) => {
                                if (!user) {
                                    e.preventDefault();
                                    setIsNavOpen(false);
                                    navigate('/account', { state: { mode: 'signin' } });
                                } else {
                                    setIsNavOpen(false);
                                }
                            }}
                            className={`flex items-center gap-4 p-4 rounded-lg border transition-all active:scale-98 ${
                                user
                                    ? 'bg-bg-secondary/70 border-border/60 text-text-primary hover:bg-bg-secondary'
                                    : 'bg-bg-secondary/30 border-border/30 text-text-secondary/50'
                            }`}
                        >
                            <BarChart2 className="w-6 h-6 shrink-0" />
                            <span className="flex-1 text-lg font-medium">Solve Logs & Stats</span>
                            {!user && <Lock className="w-4 h-4 text-text-secondary/50 shrink-0" />}
                        </NavLink>

                        <NavLink
                            to={user ? "/goals" : "#"}
                            onClick={(e) => {
                                if (!user) {
                                    e.preventDefault();
                                    setIsNavOpen(false);
                                    navigate('/account', { state: { mode: 'signin' } });
                                } else {
                                    setIsNavOpen(false);
                                }
                            }}
                            className={`flex items-center gap-4 p-4 rounded-lg border transition-all active:scale-98 ${
                                user
                                    ? 'bg-bg-secondary/70 border-border/60 text-text-primary hover:bg-bg-secondary'
                                    : 'bg-bg-secondary/30 border-border/30 text-text-secondary/50'
                            }`}
                        >
                            <Target className="w-6 h-6 shrink-0" />
                            <span className="flex-1 text-lg font-medium">Goals & Milestones</span>
                            {!user && <Lock className="w-4 h-4 text-text-secondary/50 shrink-0" />}
                        </NavLink>

                        <NavLink
                            to="/social"
                            onClick={() => setIsNavOpen(false)}
                            className="flex items-center gap-4 p-4 rounded-lg bg-bg-secondary/70 border border-border/60 text-text-primary hover:bg-bg-secondary transition-all active:scale-98"
                        >
                            <Users className="w-6 h-6 shrink-0" />
                            <span className="flex-1 text-lg font-medium">Cubing Community</span>
                        </NavLink>
                    </div>

                    {/* Bottom Utility Bar (Account, Theme, Privacy) */}
                    <div className="pt-4 pb-2 border-t border-border/40 shrink-0 flex flex-col gap-3">
                        {/* Account Link - less rounded */}
                        <div
                            onClick={() => {
                                setIsNavOpen(false);
                                navigate('/account');
                            }}
                            className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary border border-border/50 cursor-pointer active:scale-98"
                        >
                            <div className="flex items-center gap-3">
                                <UserAvatar
                                    user={user}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-sm"
                                    roundedClassName="rounded-lg"
                                >
                                    {(user && !user.isAnonymous) ? user.username.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                                </UserAvatar>
                                <div className="text-left">
                                    <div className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                                        <span>{(user && !user.isAnonymous) ? user.username : 'Guest User'}</span>
                                        {user && !user.isAnonymous && hasLinkedWca(user) && (
                                            <span
                                                title={`Verified WCA Competitor (${user.wcaId || 'Linked'})`}
                                                className="inline-flex items-center align-middle shrink-0"
                                            >
                                                <WcaBadge user={user} className="w-3.5 h-3.5 drop-shadow-2xs" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-text-secondary">{(user && !user.isAnonymous) ? 'View Account & Profile' : 'Sign in to save solves'}</div>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-text-secondary" />
                        </div>

                        {/* Theme Toggle Buttons - less rounded */}
                        <div className="flex items-center justify-between bg-bg-secondary rounded-lg p-1 border border-border/50">
                            <button
                                type="button"
                                onClick={() => setTheme("light")}
                                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 text-xs font-medium transition-all ${theme === 'light' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary'}`}
                            >
                                <Sun className="w-4 h-4" />
                                <span>Light</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTheme("system")}
                                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 text-xs font-medium transition-all ${theme === 'system' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary'}`}
                            >
                                <Monitor className="w-4 h-4" />
                                <span>System</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTheme("dark")}
                                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 text-xs font-medium transition-all ${theme === 'dark' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary'}`}
                            >
                                <Moon className="w-4 h-4" />
                                <span>Dark</span>
                            </button>
                        </div>

                        {/* Privacy Policy */}
                        <div className="text-center pt-1">
                            <NavLink
                                to="/privacy"
                                onClick={() => setIsNavOpen(false)}
                                className="text-xs text-text-secondary/70 hover:text-text-primary inline-flex items-center gap-1"
                            >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Privacy Policy</span>
                            </NavLink>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL SCREEN TIMER TOOLS MODAL */}
            {isToolsOpen && (
                <div
                    className="fixed inset-0 z-50 bg-bg-primary flex flex-col pt-safe pb-safe select-none overflow-y-auto no-scrollbar animate-in fade-in duration-200"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0 sticky top-0 bg-bg-primary/95 backdrop-blur-md z-10">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="w-5 h-5 text-accent" />
                            <span className="text-lg font-bold tracking-tight text-text-primary">Timer Tools</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsToolsOpen(false)}
                            className="w-9 h-9 rounded-lg bg-bg-secondary border border-border/60 flex items-center justify-center text-text-secondary hover:text-text-primary active:scale-95 cursor-pointer"
                            aria-label="Close timer tools"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col gap-6 max-w-lg mx-auto w-full">
                        {/* 1. Scramble & Session Controls AT THE TOP */}
                        <div className="flex flex-col gap-2.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                                Scramble & Session Controls
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={generateNewScramble}
                                    className="flex items-center justify-center gap-2 p-3 rounded-lg bg-bg-secondary border border-border/60 text-sm font-semibold text-text-primary hover:bg-bg-hover active:scale-95 cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4 text-accent" />
                                    <span>Next Scramble</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyScramble}
                                    className="flex items-center justify-center gap-2 p-3 rounded-lg bg-bg-secondary border border-border/60 text-sm font-semibold text-text-primary hover:bg-bg-hover active:scale-95 cursor-pointer"
                                >
                                    {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-text-secondary" />}
                                    <span>{isCopied ? 'Copied!' : 'Copy Scramble'}</span>
                                </button>
                            </div>

                            {user && (
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        type="button"
                                        onClick={toggleGhostMode}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold active:scale-95 transition-all cursor-pointer ${
                                            isGhostMode
                                                ? 'bg-purple-500/15 border-purple-500 text-purple-400'
                                                : 'bg-bg-secondary border-border/60 text-text-secondary'
                                        }`}
                                    >
                                        <Ghost className="w-4 h-4" />
                                        <span>{isGhostMode ? 'Ghost: On' : 'Ghost Mode'}</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 2. Scramble Event Selector */}
                        <div className="flex flex-col gap-2.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                                Puzzle Event
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {allEvents.map(opt => {
                                    const isSelected = settings.scrambleType === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => updateSettings({ scrambleType: opt.value })}
                                            className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-all text-center active:scale-95 cursor-pointer ${
                                                isSelected
                                                    ? 'bg-accent text-white border-accent shadow-sm'
                                                    : 'bg-bg-secondary/70 border-border/60 text-text-secondary hover:text-text-primary'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setIsCreateEventOpen(true)}
                                    className="py-2 px-1 rounded-lg text-xs font-semibold border border-dashed border-accent/40 text-accent hover:bg-accent/10 transition-all text-center active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add</span>
                                </button>
                            </div>
                        </div>

                        {/* 3. Scramble Size with Live Example Preview */}
                        <div className="flex flex-col gap-3 p-4 rounded-lg bg-bg-secondary/60 border border-border/60">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                                    Scramble Size
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => updateSettings({ scrambleSize: Math.max(0.8, Number((settings.scrambleSize - 0.2).toFixed(1))) })}
                                        className="w-8 h-8 rounded-md bg-bg-primary border border-border/60 flex items-center justify-center text-text-secondary hover:text-text-primary active:scale-90 cursor-pointer"
                                        title="Decrease size"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="font-mono text-xs font-bold text-text-primary min-w-[3rem] text-center">
                                        {settings.scrambleSize.toFixed(1)}rem
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => updateSettings({ scrambleSize: Math.min(2.6, Number((settings.scrambleSize + 0.2).toFixed(1))) })}
                                        className="w-8 h-8 rounded-md bg-bg-primary border border-border/60 flex items-center justify-center text-text-secondary hover:text-text-primary active:scale-90 cursor-pointer"
                                        title="Increase size"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Live Example Scramble Box */}
                            <div className="p-3.5 rounded-lg bg-bg-primary border border-border/50 flex flex-col gap-1.5 overflow-hidden">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-text-secondary/60">
                                    Preview at current size:
                                </div>
                                <div
                                    className="font-mono text-text-primary leading-relaxed text-center break-words transition-all"
                                    style={{ fontSize: `${settings.scrambleSize * 0.75}rem` }}
                                >
                                    R U R&apos; U&apos; R&apos; F R2 U&apos; R&apos; U&apos; R U R&apos; F&apos;
                                </div>
                            </div>
                        </div>

                        {/* 4. Timer Preferences (NO ICONS, clean text + switches) */}
                        <div className="flex flex-col gap-2.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                                Timer Options
                            </label>

                            <div className="flex flex-col gap-2">
                                {/* Inspection Toggle */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary/60 border border-border/60">
                                    <div>
                                        <div className="text-sm font-semibold text-text-primary">15s WCA Inspection</div>
                                        <div className="text-[11px] text-text-secondary">Official 15-second inspection before solve</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => updateSettings({ solveInspection: !settings.solveInspection })}
                                        className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer ${settings.solveInspection ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.solveInspection ? 'translate-x-5.5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Live Timer Toggle */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary/60 border border-border/60">
                                    <div>
                                        <div className="text-sm font-semibold text-text-primary">Show Live Running Time</div>
                                        <div className="text-[11px] text-text-secondary">Display timer milliseconds during solve</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => updateSettings({ showLiveTimer: !settings.showLiveTimer })}
                                        className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer ${settings.showLiveTimer ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.showLiveTimer ? 'translate-x-5.5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Scramble Visibility Toggle */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary/60 border border-border/60">
                                    <div>
                                        <div className="text-sm font-semibold text-text-primary">Scramble Text</div>
                                        <div className="text-[11px] text-text-secondary">{scrambleVisible ? 'Visible on timer screen' : 'Hidden for blindfold / practice'}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setScrambleVisible(!scrambleVisible)}
                                        className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer ${scrambleVisible ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${scrambleVisible ? 'translate-x-5.5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Priming Hold Time */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary/60 border border-border/60">
                                    <div>
                                        <div className="text-sm font-semibold text-text-primary">Hold to Start Duration</div>
                                        <div className="text-[11px] text-text-secondary">Finger hold time before timer readies</div>
                                    </div>
                                    <div className="flex items-center gap-1 bg-bg-primary rounded-lg p-1 border border-border/50">
                                        {[0.3, 0.6, 1.0].map((len) => (
                                            <button
                                                key={len}
                                                type="button"
                                                onClick={() => updateSettings({ primingLength: len })}
                                                className={`px-2 py-1 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer ${
                                                    settings.primingLength === len
                                                        ? 'bg-accent text-white shadow-xs'
                                                        : 'text-text-secondary hover:text-text-primary'
                                                }`}
                                            >
                                                {len}s
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <CreateEventModal
                isOpen={isCreateEventOpen}
                onClose={() => setIsCreateEventOpen(false)}
                onCreated={(newEvent) => {
                    updateSettings({ scrambleType: newEvent.id });
                }}
            />
        </div>
    );
}
