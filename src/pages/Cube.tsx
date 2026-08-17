import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { randomScrambleForEvent } from 'cubing/scramble';
import { useSettings } from '../contexts/SettingsContext';
import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import { useGoals } from '../contexts/GoalsContext';
import { Link } from 'react-router-dom';
import {
    EyeOff,
    Minus,
    Plus,
    Radio,
    Search,
    ChevronUp,
    ChevronDown,
    SkipForward,
    CheckCircle2,
    Pin
} from 'lucide-react';
import { formatTime } from '../utils/formatTime';
import { rtdb } from '../lib/firebase';
import { ref, onDisconnect, set, onValue, remove } from 'firebase/database';
import type { LiveUser, SimpleSolve, TimerState } from '../types';
import { UserCard, KeybindTooltip } from '../components';

export default function Cube() {
    const { settings, updateSettings } = useSettings();
    const { solves, addSolve, updateSolve, currentScramble, setCurrentScramble } = useSolves();
    const { startNewSession, currentSessionId } = useSession();
    const { user, toggleStarUser, toggleBlockUser } = useAuth();
    const { pinnedGoals } = useGoals();

    const scrambleType = settings.scrambleType;

    // Last finished solve tracking for 5s penalty shortcuts
    const lastFinishedSolveRef = useRef<{ id: string; timestamp: number } | null>(null);
    const [penaltyFeedback, setPenaltyFeedback] = useState<{ text: string; type: string } | null>(null);

    // Live Mode State
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [connectedUsers, setConnectedUsers] = useState<LiveUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [bottomBarCollapsed, setBottomBarCollapsed] = useState(false);

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

    // Helper for live solves broadcast
    const formatRecentSolves = useCallback((): SimpleSolve[] => {
        return solves.slice(0, 4).map(s => ({
            time: s.time,
            penalty: s.penalty,
            inspectionPenalty: s.inspectionPenalty,
            timestamp: new Date(s.date).getTime()
        }));
    }, [solves]);

    // Firebase Presence Logic
    useEffect(() => {
        if (!user || !isLiveMode) return;

        const userPresenceRef = ref(rtdb, `presence/${user.uid}`);
        const currentRecent = formatRecentSolves();

        const updatePresence = () => {
            const data: LiveUser = {
                uid: user.uid,
                username: user.username || 'CubingUser',
                color: user.color || '#ef4444',
                status: timerState,
                lastSolveTime: (solves.length > 0 && typeof solves[0]?.time === 'number') ? solves[0].time : null,
                recentSolves: currentRecent,
                timestamp: Date.now()
            };
            set(userPresenceRef, data);
        };

        updatePresence();
        onDisconnect(userPresenceRef).remove();

        return () => {
            remove(userPresenceRef);
        };
    }, [user, timerState, solves, formatRecentSolves, isLiveMode]);

    // Listen for other users
    useEffect(() => {
        if (!isLiveMode) {
            setConnectedUsers([]);
            return;
        }

        const presenceRef = ref(rtdb, 'presence');
        const unsubscribe = onValue(presenceRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const users: LiveUser[] = Object.values(data);
                const others = users.filter(u => u.uid !== user?.uid);
                setConnectedUsers(others);
            } else {
                setConnectedUsers([]);
            }
        });

        return () => unsubscribe();
    }, [user, isLiveMode]);

    // Filter connected users
    const { favoriteUsers, communityUsers } = useMemo(() => {
        if (!user) return { favoriteUsers: [], communityUsers: [] };
        const starred = user.starredUsers || [];
        const blocked = user.blockedUsers || [];
        const q = searchQuery.toLowerCase();

        const allowed = connectedUsers.filter(u => !blocked.includes(u.uid));
        const favs = allowed.filter(u => starred.includes(u.uid));
        const comms = allowed.filter(u => !starred.includes(u.uid));

        const filterFn = (u: LiveUser) => u.username.toLowerCase().includes(q);

        return {
            favoriteUsers: favs.filter(filterFn),
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
            if (timerState === 'INSPECTION') {
                setTimerState('IDLE');
                setInspectionTime(15);
            }
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

    // Live Actions
    const handleStar = (targetUid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        toggleStarUser(targetUid);
    };

    const handleBlock = (targetUid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Block this user? You won't see them on Live anymore.")) {
            toggleBlockUser(targetUid);
        }
    };

    const formatRunningTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return seconds.toString();
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full relative overflow-hidden">

            {/* LIVE BAR (Top) */}
            {isLiveMode && favoriteUsers.length > 0 && (
                <div className="flex-shrink-0 border-b border-border bg-bg-secondary/50 backdrop-blur-sm p-4 flex gap-4 overflow-x-auto items-center h-40 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500/20" />
                    {favoriteUsers.map(u => (
                        <UserCard
                            key={u.uid}
                            user={u}
                            isStarred={true}
                            onStar={handleStar}
                            onBlock={handleBlock}
                        />
                    ))}
                </div>
            )}

            {/* MAIN TIMER STAGE */}
            <div
                className="flex-1 flex flex-col items-center justify-center select-none min-h-0 relative z-10"
                style={{ opacity: (timerState === 'PRIMING' && primingProgress < 1) ? 0.6 : 1 }}
            >
                {/* PINNED GOALS BANNER */}
                {user && pinnedGoals.length > 0 && timerState === 'IDLE' && (
                    <div className="mb-6 w-full max-w-2xl px-4 animate-in fade-in duration-200">
                        <div className="bg-surface-elevation-1 border border-border/80 rounded-xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-1.5 px-1 text-text-secondary">
                                <Pin className="w-3.5 h-3.5 text-accent" />
                                <span className="text-[11px] font-semibold uppercase tracking-wider">Goals</span>
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {pinnedGoals.map(goal => (
                                    <Link
                                        key={goal.goalId}
                                        to="/goals"
                                        className="bg-bg-secondary hover:bg-bg-hover border border-border/60 rounded-lg px-2.5 py-1.5 flex flex-col justify-between gap-1 transition-colors"
                                        title={`${goal.title}: ${goal.displayCurrent} / ${goal.displayTarget}`}
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-medium text-text-primary truncate">
                                                {goal.title}
                                            </span>
                                            {goal.completed ? (
                                                <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                                            ) : (
                                                <span className="text-[10px] font-mono text-text-secondary">
                                                    {goal.percentCompleted}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-full h-1 bg-bg-primary rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${goal.completed ? 'bg-green-500' : 'bg-accent'}`}
                                                style={{ width: `${goal.percentCompleted}%` }}
                                            />
                                        </div>
                                    </Link>
                                ))}
                            </div>
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
                        <div className="mb-8 text-center max-w-2xl min-h-[4rem] flex flex-col items-center justify-center">
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

            {/* COMMUNITY BAR (Bottom) */}
            {isLiveMode && (
                <div className="flex-shrink-0 border-t border-border bg-bg-secondary/70 backdrop-blur-sm relative z-10">
                    <div className="px-4 py-1.5 border-b border-border/40 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-text-secondary">
                            <Search className="w-3.5 h-3.5" />
                            <input
                                type="text"
                                placeholder="Filter active solvers..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="bg-transparent text-xs text-text-primary focus:outline-none placeholder:text-text-secondary/50 w-36 sm:w-48"
                            />
                        </div>
                        <button
                            onClick={() => setBottomBarCollapsed(prev => !prev)}
                            className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        >
                            <span>{bottomBarCollapsed ? 'Expand Community' : 'Collapse'}</span>
                            {bottomBarCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                    </div>

                    <div
                        className={`flex gap-4 overflow-x-auto items-center transition-all duration-300 ease-in-out
                        ${bottomBarCollapsed ? 'h-0 opacity-0 p-0 overflow-hidden' : 'h-40 p-4'}`}
                    >
                        {communityUsers.length === 0 && (
                            <div className="text-text-secondary text-sm italic w-full text-center opacity-50">
                                {searchQuery ? 'No matching users found.' : 'No other users connected...'}
                            </div>
                        )}
                        {communityUsers.map(u => (
                            <UserCard
                                key={u.uid}
                                user={u}
                                isStarred={false}
                                onStar={handleStar}
                                onBlock={handleBlock}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* KEYBIND & POWER-USER FEATURE TOOLTIPS */}
            <KeybindTooltip timerState={timerState} totalSolves={solves.length} />
        </div>
    );
}
