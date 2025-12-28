import { useRef, useState, useEffect, useCallback } from 'react';
import { randomScrambleForEvent } from 'cubing/scramble';
import { useSettings } from '../contexts/SettingsContext';
import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import { EyeOff, Info, Minus, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { rtdb } from '../lib/firebase';
import { ref, onDisconnect, set, onValue, remove } from 'firebase/database';

type TimerState = 'IDLE' | 'INSPECTION' | 'PRIMING' | 'RUNNING' | 'SOLVED';

interface LiveUser {
    uid: string;
    username: string;
    color: string;
    status: TimerState;
    lastSolveTime?: number;
    lastSolveScramble?: string;
    timestamp: number;
}

export default function Live() {
    const { settings, updateSettings } = useSettings();
    const { addSolve, currentScramble, setCurrentScramble, solves } = useSolves();
    const { startNewSession, currentSessionId } = useSession();
    const { user } = useAuth();
    const [autoSessionToastVisible, setAutoSessionToastVisible] = useState(false);

    // Live User Data
    const [connectedUsers, setConnectedUsers] = useState<LiveUser[]>([]);

    useEffect(() => {
        if (user && !currentSessionId) {
            startNewSession(false).then(() => {
                setAutoSessionToastVisible(true);
                setTimeout(() => setAutoSessionToastVisible(false), 3000);
            });
        }
    }, [user, currentSessionId, startNewSession]);

    // --- Standard Cube Logic ---
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
    const prevTimerStateRef = useRef<TimerState>('IDLE');
    const inspectionStartTimeRef = useRef<number | null>(null);
    const inspectionUsedRef = useRef<number>(0);

    // Firebase Presence Logic
    useEffect(() => {
        if (!user) return;

        const userPresenceRef = ref(rtdb, `presence/${user.uid}`);

        // Set initial data and onDisconnect
        const updatePresence = () => {
            const data: LiveUser = {
                uid: user.uid,
                username: user.username || 'CubingUser',
                color: user.color || '#3b82f6',
                status: timerState,
                // Basic last solve info if available
                lastSolveTime: solves.length > 0 ? solves[0].time : undefined,
                timestamp: Date.now()
            };
            set(userPresenceRef, data);
        };

        updatePresence();
        onDisconnect(userPresenceRef).remove();

        // Update when status changes
        set(userPresenceRef, {
            uid: user.uid,
            username: user.username || 'CubingUser',
            color: user.color || '#3b82f6',
            status: timerState,
            lastSolveTime: solves.length > 0 ? solves[0].time : undefined,
            timestamp: Date.now()
        });

        return () => {
            remove(userPresenceRef);
        };
    }, [user, timerState, solves]);

    // Listen for other users
    useEffect(() => {
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
    }, [user]);


    // Fetch new scramble
    const generateNewScramble = useCallback(async () => {
        try {
            const s = await randomScrambleForEvent('333');
            const scrambleStr = s.toString();
            setScramble(scrambleStr);
            setCurrentScramble(scrambleStr);
        } catch (e) {
            console.error(e);
            const fallback = "R U R' U'";
            setScramble(fallback);
            setCurrentScramble(fallback);
        }
    }, [setCurrentScramble]);

    useEffect(() => {
        if (!currentScramble) {
            generateNewScramble();
        }
    }, [currentScramble, generateNewScramble]);

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
            startTimeRef.current = performance.now() - 0;
            animationFrameId = requestAnimationFrame(animate);
        }
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [timerState]);

    // Inspection Timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        const shouldRunInspection = timerState === 'INSPECTION' ||
            (timerState === 'PRIMING' && prevTimerStateRef.current === 'INSPECTION');

        if (shouldRunInspection) {
            interval = setInterval(() => {
                if (inspectionStartTimeRef.current) {
                    const elapsed = (Date.now() - inspectionStartTimeRef.current) / 1000;
                    const remaining = Math.ceil(15 - elapsed);
                    setInspectionTime(prev => {
                        if (prev !== remaining) return remaining;
                        return prev;
                    });
                }
            }, 100);
        }
        return () => clearInterval(interval);
    }, [timerState]);

    // Priming Animation
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

    const finishSolve = useCallback(() => {
        setTimerState('SOLVED');
        setPrimingProgress(0);
        let finalInspectionPenalty: 'none' | '+2' | 'DNF' = initialPenaltyRef.current;

        addSolve({
            id: crypto.randomUUID(),
            time: time,
            scramble: scramble,
            date: new Date().toISOString(),
            penalty: 'none',
            inspectionTime: inspectionUsedRef.current || (15 - inspectionTime),
            daily: null,
            inspectionPenalty: finalInspectionPenalty
        });
        generateNewScramble();
    }, [time, scramble, addSolve, generateNewScramble, inspectionTime]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.repeat) return;
        if (e.code === 'Space') {
            if (timerState === 'IDLE') {
                if (settings.solveInspection) {
                    prevTimerStateRef.current = timerState;
                    setTimerState('INSPECTION');
                    setInspectionTime(15);
                    inspectionStartTimeRef.current = Date.now();
                } else {
                    prevTimerStateRef.current = timerState;
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
                prevTimerStateRef.current = timerState;
                primingStartRef.current = Date.now();
                setTimerState('PRIMING');
                setPrimingProgress(0);
            } else if (timerState === 'RUNNING') {
                finishSolve();
            } else if (timerState === 'SOLVED') {
                if (settings.solveInspection) {
                    prevTimerStateRef.current = timerState;
                    setTimerState('INSPECTION');
                    setInspectionTime(15);
                    inspectionStartTimeRef.current = Date.now();
                } else {
                    prevTimerStateRef.current = timerState;
                    primingStartRef.current = Date.now();
                    setTimerState('PRIMING');
                    setPrimingProgress(0);
                }
            }
        } else if (e.key === 'Escape') {
            if (timerState === 'INSPECTION') {
                setTimerState('IDLE');
                setInspectionTime(15);
            }
        } else {
            if (timerState === 'RUNNING') {
                finishSolve();
            }
        }
    }, [timerState, settings.solveInspection, finishSolve]);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        if (e.code === 'Space') {
            if (timerState === 'PRIMING') {
                const elapsed = (Date.now() - (primingStartRef.current || 0)) / 1000;
                if (elapsed >= settings.primingLength) {
                    if (settings.solveInspection) {
                        if (inspectionTime <= 0) {
                            if (inspectionTime > -2) initialPenaltyRef.current = '+2';
                            else initialPenaltyRef.current = 'DNF';
                        } else {
                            initialPenaltyRef.current = 'none';
                        }
                    }
                    setTimerState('RUNNING');
                } else {
                    primingStartRef.current = null;
                    setPrimingProgress(0);
                    if (settings.solveInspection) setTimerState('INSPECTION');
                    else setTimerState('IDLE');
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
    const formatTime = (ms: number) => (ms / 1000).toFixed(2);
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

    return (
        <div className="flex flex-col h-full relative">
            <div
                className="flex-1 flex flex-col items-center justify-center select-none"
                style={{ opacity: (timerState === 'PRIMING' && primingProgress < 1) ? 0.6 : 1 }}
            >
                {/* Scramble Toolbar & Content */}
                {scrambleVisible ? (
                    <>
                        <div className="flex items-center gap-6 mb-4 text-text-secondary transition-opacity hover:text-text-primary">
                            <Link to="/about" className="hover:text-accent transition-colors" title="Scramble Info">
                                <Info className="w-5 h-5" />
                            </Link>
                            <button onClick={() => setScrambleVisible(false)} className="hover:text-accent transition-colors" title="Hide Scramble">
                                <EyeOff className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-4">
                                <button onClick={() => changeScrambleSize(-0.1)} className="hover:text-accent transition-colors" title="Smaller">
                                    <Minus className="w-5 h-5" />
                                </button>
                                <button onClick={() => changeScrambleSize(0.1)} className="hover:text-accent transition-colors" title="Larger">
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="mb-10 text-center max-w-2xl min-h-[4rem] flex flex-col items-center justify-center">
                            <p
                                onClick={handleCopyScramble}
                                className="font-mono text-text-secondary leading-relaxed text-center transition-all cursor-pointer hover:text-text-primary active:scale-95"
                                style={{ fontSize: `${settings.scrambleSize}rem` }}
                                title="Click to copy"
                            >
                                {scramble}
                            </p>
                            {isCopied && <div className="text-xs text-green-500 mt-2 font-medium animate-in fade-in slide-in-from-top-1">Copied!</div>}
                        </div>
                    </>
                ) : (
                    <div className="mb-10 min-h-[4rem] flex items-center justify-center">
                        <button
                            onClick={() => setScrambleVisible(true)}
                            className="font-mono text-text-secondary/50 italic hover:text-text-primary transition-colors cursor-pointer"
                        >
                            Scramble hidden
                        </button>
                    </div>
                )}

                <div className="text-center">
                    {timerState === 'INSPECTION' ? (
                        <h1 className={`text-9xl font-normal font-mono ${getInspectionColor()}`}>
                            {Math.abs(inspectionTime)}
                        </h1>
                    ) : timerState === 'RUNNING' ? (
                        settings.showLiveTimer ? (
                            <h1 className={`text-9xl font-normal font-mono text-text-primary`}>
                                {Math.floor(time / 1000)}
                            </h1>
                        ) : (
                            <h1 className={`text-9xl font-normal font-mono text-text-primary tracking-widest`}>
                                SOLVE
                            </h1>
                        )
                    ) : timerState === 'PRIMING' ? (
                        primingProgress >= 1 ? (
                            <h1 className="text-9xl font-normal font-mono text-green-500">
                                Ready
                            </h1>
                        ) : (
                            prevTimerStateRef.current === 'INSPECTION' ? (
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
                        <h1 className={`text-9xl font-normal font-mono text-text-primary`}>
                            {formatTime(time)}
                        </h1>
                    )}
                </div>

                <Toast
                    visible={autoSessionToastVisible}
                    message="New session started automatically."
                    onClose={() => setAutoSessionToastVisible(false)}
                />
            </div>

            {/* LIVE BAR */}
            <div className="h-32 border-t border-border bg-background/50 backdrop-blur-sm p-4 flex gap-4 overflow-x-auto items-center">
                {connectedUsers.length === 0 && (
                    <div className="text-text-secondary text-sm italic w-full text-center">
                        No other users connected...
                    </div>
                )}
                {connectedUsers.map(u => (
                    <div key={u.uid} className="flex-shrink-0 w-48 bg-surface-elevation-1 rounded-lg p-3 border border-border flex flex-col gap-2 relative overflow-hidden">
                        {/* Status Indicator */}
                        <div className={`absolute top-0 left-0 w-1 h-full 
                            ${u.status === 'RUNNING' ? 'bg-green-500' :
                                u.status === 'INSPECTION' ? 'bg-orange-500' :
                                    u.status === 'SOLVED' ? 'bg-blue-500' : 'bg-gray-500'
                            }`}
                        />

                        <div className="flex items-center gap-2 pl-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: u.color }} />
                            <span className="font-semibold text-text-primary truncate">{u.username}</span>
                        </div>

                        <div className="pl-2">
                            <div className="text-xs text-text-secondary uppercase tracking-wider mb-0.5">
                                {u.status === 'IDLE' ? 'Idle' :
                                    u.status === 'RUNNING' ? 'Solving...' :
                                        u.status === 'INSPECTION' ? 'Inspecting' :
                                            u.status === 'SOLVED' ? 'Solved' : 'Ready'}
                            </div>
                            {u.lastSolveTime && (
                                <div className="text-xl font-mono text-text-primary">
                                    {(u.lastSolveTime / 1000).toFixed(2)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
