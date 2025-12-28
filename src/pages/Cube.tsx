import { useRef, useState, useEffect, useCallback } from 'react';
import { randomScrambleForEvent } from 'cubing/scramble';
import { useSettings } from '../contexts/SettingsContext';
import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
// import { useConfirm } from '../contexts/ConfirmationContext'; // Unused
import Toast from '../components/Toast';
import { EyeOff, Info, Minus, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

type TimerState = 'IDLE' | 'INSPECTION' | 'PRIMING' | 'RUNNING' | 'SOLVED';

export default function Cube() {
    const { settings, updateSettings } = useSettings();
    const { isPrivateMode } = useSolves(); // Destructure isPrivateMode
    const { addSolve, currentScramble, setCurrentScramble } = useSolves();
    const { startNewSession, currentSessionId } = useSession();
    const { user } = useAuth();
    // const { confirm: confirmAction } = useConfirm(); // Unused
    const [autoSessionToastVisible, setAutoSessionToastVisible] = useState(false);

    // Loot Stats State
    // const [lootModifier, setLootModifier] = useState<number>(0); // Unused

    // Auto-create session and toast logic
    useEffect(() => {
        if (user && !currentSessionId) {
            startNewSession(false).then(() => {
                // setAutoSessionToastVisible(true); // Maybe keeps this just for info? User didn't ask to remove THIS toast, just the "asking to start" popup.
                // Actually, "popups asking to start a new session". 
                // Let's keep the purely informational "started" toast for lazy creation if it helps, or remove it for cleanliness.
                // I'll keep it as it's not a "popup asking" (modal/interactive).
                setAutoSessionToastVisible(true);
                setTimeout(() => setAutoSessionToastVisible(false), 3000);
            });
        }

        // Fetch loot stats - REMOVED (Feature removed)
        /*
        if (user && !isPrivateMode) {
           ...
        }
        */
    }, [user, currentSessionId, startNewSession, isPrivateMode]);

    const [scramble, setScramble] = useState<string>(currentScramble || 'Generating scramble...');
    const [timerState, setTimerState] = useState<TimerState>('IDLE');
    const [time, setTime] = useState(0);
    const [inspectionTime, setInspectionTime] = useState(15);
    const [primingProgress, setPrimingProgress] = useState(0); // 0 to 1
    const [scrambleVisible, setScrambleVisible] = useState(true);
    // const [scrambleRotation, setScrambleRotation] = useState(0); // For simple animation // Unused
    const [isCopied, setIsCopied] = useState(false);

    const startTimeRef = useRef<number>(0);
    const primingStartRef = useRef<number | null>(null);
    const initialPenaltyRef = useRef<Solve['penalty']>('none');
    const prevTimerStateRef = useRef<TimerState>('IDLE');

    const inspectionStartTimeRef = useRef<number | null>(null);
    const inspectionUsedRef = useRef<number>(0); // Store exact inspection time used (ms)

    const [specialType, setSpecialType] = useState<'normal' | 'y' | 'm' | 'w' | 'd' | 'h'>('normal');
    const [specialId, setSpecialId] = useState<string | null>(null);

    // Fetch new scramble
    const generateNewScramble = useCallback(async () => {
        try {
            // Check for special scramble first if user is logged in AND NOT PRIVATE
            if (user && !isPrivateMode) {
                //Dynamic import to avoid circular dep issues early on if any
                const { getDailyScramble } = await import('../utils/dailyScramble');
                const special = await getDailyScramble(user.uid);

                if (special.type !== 'normal' && special.scramble) {
                    setScramble(special.scramble);
                    setCurrentScramble(special.scramble);
                    setSpecialType(special.type);
                    setSpecialId(special.id || null);
                    return;
                }
            }

            // Normal Flow
            setSpecialType('normal');
            setSpecialId(null);
            // Using 333 for now as requested default, can expand later
            const s = await randomScrambleForEvent('333');
            const scrambleStr = s.toString();
            setScramble(scrambleStr);
            setCurrentScramble(scrambleStr);
        } catch (e) {
            console.error(e);
            const fallback = "R U R' U'";
            setScramble(fallback);
            setCurrentScramble(fallback);
            setSpecialType('normal');
            setSpecialId(null);
        }
    }, [setCurrentScramble, user, isPrivateMode]);

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
            startTimeRef.current = performance.now() - 0; // Start fresh
            animationFrameId = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [timerState]);

    // Inspection Logic
    // Inspection Timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;

        // Run inspection timer if in INSPECTION *OR* if Priming (but came from Inspection)
        // This prevents the timer from "pausing" when holding spacebar.
        const shouldRunInspection = timerState === 'INSPECTION' ||
            (timerState === 'PRIMING' && prevTimerStateRef.current === 'INSPECTION');

        // We need to track *exact* inspection elapsed time for the record
        // The display interval (below) is for UI.
        // We can capture the exact elapsed time when spacing (transition to PRIMING).

        if (shouldRunInspection) {
            // Use short interval to update display without drift
            interval = setInterval(() => {
                if (inspectionStartTimeRef.current) {
                    const elapsed = (Date.now() - inspectionStartTimeRef.current) / 1000;
                    // Standard WCA: 15 seconds. 
                    // Display: 15 (0-1s), 14 (1-2s)...
                    // We use ceil to match this. 15 - 0.1 = 14.9 -> 15.
                    const remaining = Math.ceil(15 - elapsed);

                    // Only update state if changing (optimization)
                    setInspectionTime(prev => {
                        if (prev !== remaining) return remaining;
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
        } else {
            // Reset happens in handlers
        }
        return () => cancelAnimationFrame(reqId);
    }, [timerState, settings.primingLength]);

    const finishSolve = useCallback(() => {
        setTimerState('SOLVED');
        setPrimingProgress(0);

        let finalInspectionPenalty: 'none' | '+2' | 'DNF' = 'none';

        // Calculate based on last inspection time if we came from inspection?
        // Actually, we captured initialPenaltyRef at start of priming.
        // But let's actally trust the ref we set during handleKeyDown.
        finalInspectionPenalty = initialPenaltyRef.current;


        addSolve({
            id: crypto.randomUUID(),
            time: time,
            scramble: scramble,
            date: new Date().toISOString(),
            penalty: 'none', // Manual penalty starts as none
            inspectionTime: inspectionUsedRef.current || (15 - inspectionTime), // Use precise ref, fallback to state
            daily: specialType !== 'normal' ? specialId : null,
            inspectionPenalty: finalInspectionPenalty
        });
        if (specialType !== 'normal' && user && specialId && !isPrivateMode) {
            // Dynamic import
            import('../utils/dailyScramble').then(({ markScrambleComplete }) => {
                markScrambleComplete(user.uid, specialType, specialId);
            });
        }
        generateNewScramble();
    }, [time, scramble, addSolve, generateNewScramble, inspectionTime, specialType, user, specialId, isPrivateMode]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.repeat) return;

        // Block other keys if hiding scramble? No, user only asked for click to show.

        if (e.code === 'Space') {
            if (timerState === 'IDLE') {
                if (settings.solveInspection) {
                    prevTimerStateRef.current = timerState;
                    setTimerState('INSPECTION');
                    setInspectionTime(15); // Reset inspection time
                    inspectionStartTimeRef.current = Date.now();
                } else {
                    prevTimerStateRef.current = timerState;
                    primingStartRef.current = Date.now();
                    setTimerState('PRIMING');
                    setPrimingProgress(0);
                }
            } else if (timerState === 'INSPECTION') {
                // primingStart logic only, penalty calculated on release
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
                // No need to stopPropagation as Layout navigates to '/' which is no-op here
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
                    // Calculate Penalty on Release
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
    const formatTime = (ms: number) => (ms / 1000).toFixed(2);

    const getInspectionColor = () => {
        if (inspectionTime > 7) return 'text-text-primary'; // 15-8 (Black/Default)
        if (inspectionTime > 3) return 'text-orange-500';   // 7-4 (Orange)
        return 'text-red-500';                              // 3+ (Red)
    };

    const handleCopyScramble = () => {
        navigator.clipboard.writeText(scramble);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // const handleNextScramble = () => { // Unused
    //     setScrambleRotation(prev => prev + 360);
    //     generateNewScramble();
    // };

    const changeScrambleSize = (delta: number) => {
        updateSettings({ scrambleSize: Math.max(0.8, Math.min(3, settings.scrambleSize + delta)) });
    };

    return (
        <div
            className="flex flex-col items-center justify-center h-full select-none"
            style={{ opacity: (timerState === 'PRIMING' && primingProgress < 1) ? 0.6 : 1 }}
        >

            {/* Scramble Toolbar & Content */}
            {scrambleVisible ? (
                <>
                    <div className="flex items-center gap-6 mb-4 text-text-secondary transition-opacity hover:text-text-primary">
                        {/* SPECIAL ICON INDICATOR - Hidden until solved or revealed */}
                        {specialType !== 'normal' && timerState !== 'SOLVED' && (
                            // Requirement: "Remove showing if the displayed scramble is a special scramble, it should only be revealed to the user after they complete the scramble."
                            // So hide this block entirely unless SOLVED?
                            // But maybe keep a mystery icon?
                            // "it should only be revealed to the user after they complete the scramble."
                            // This implies they shouldn't know it's special.
                            // So I'll hide it.
                            null
                        )}

                        {/* If solved, show it! */}
                        {specialType !== 'normal' && timerState === 'SOLVED' && (
                            <div className="flex items-center justify-center animate-in zoom-in spin-in-12 duration-500">
                                <div
                                    className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold capitalize text-white shadow-lg
                                    ${specialType === 'h' ? 'bg-gray-500' : ''}
                                    ${specialType === 'd' ? 'bg-green-500' : ''}
                                    ${specialType === 'w' ? 'bg-blue-500' : ''}
                                    ${specialType === 'm' ? 'bg-purple-500' : ''}
                                    ${specialType === 'y' ? 'bg-yellow-500 text-black' : ''}
                                    `}
                                    title={`Special Scramble: ${specialType === 'h' ? 'Hourly' : specialType === 'd' ? 'Daily' : specialType === 'w' ? 'Weekly' : specialType === 'm' ? 'Monthly' : 'Yearly'}`}
                                >
                                    {specialType.toUpperCase()}
                                </div>
                            </div>
                        )}

                        <Link to="/about" className="hover:text-accent transition-colors" title="Scramble Info">
                            <Info className="w-5 h-5" />
                        </Link>

                        <button onClick={() => setScrambleVisible(false)} className="hover:text-accent transition-colors" title="Hide Scramble">
                            <EyeOff className="w-5 h-5" />
                        </button>

                        {/* Separate Size Buttons */}
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
                        {/* Loot Chance Display - REMOVED */}
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

            {/* Auto-Created Session Toast */}
            <Toast
                visible={autoSessionToastVisible}
                message="New session started automatically."
                onClose={() => setAutoSessionToastVisible(false)}
            />
        </div>
    );
}
