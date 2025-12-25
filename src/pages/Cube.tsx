import { useState, useEffect, useRef, useCallback } from 'react';
import { randomScrambleForEvent } from 'cubing/scramble';
import { useSettings } from '../contexts/SettingsContext';
import { useSolves } from '../contexts/SolvesContext';
import { Copy, Eye, EyeOff, Info, Minus, Plus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

type TimerState = 'IDLE' | 'INSPECTION' | 'PRIMING' | 'RUNNING' | 'SOLVED';

export default function Cube() {
    const { settings, updateSettings } = useSettings();
    const { addSolve } = useSolves();

    const [scramble, setScramble] = useState<string>('Generating scramble...');
    const [timerState, setTimerState] = useState<TimerState>('IDLE');
    const [time, setTime] = useState(0);
    const [inspectionTime, setInspectionTime] = useState(15);
    const [primingProgress, setPrimingProgress] = useState(0); // 0 to 1
    const [scrambleVisible, setScrambleVisible] = useState(true);
    const [scrambleRotation, setScrambleRotation] = useState(0); // For simple animation

    const startTimeRef = useRef<number>(0);
    const primingStartRef = useRef<number | null>(null);
    const inspectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fetch new scramble
    const getScramble = useCallback(async () => {
        try {
            // Using 333 for now as requested default, can expand later
            const s = await randomScrambleForEvent('333');
            setScramble(s.toString());
        } catch (e) {
            console.error(e);
            setScramble("R U R' U'");
        }
    }, []);

    useEffect(() => {
        getScramble();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getScramble]);

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
    useEffect(() => {
        if (timerState === 'INSPECTION') {
            setInspectionTime(15);
            inspectionIntervalRef.current = setInterval(() => {
                setInspectionTime(prev => {
                    if (prev <= 1) {
                        return prev - 1;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (inspectionIntervalRef.current) clearInterval(inspectionIntervalRef.current);
        }
        return () => {
            if (inspectionIntervalRef.current) clearInterval(inspectionIntervalRef.current);
        };
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
        addSolve({
            id: crypto.randomUUID(),
            time: time,
            scramble: scramble,
            date: new Date().toISOString(),
            penalty: 'none'
        });
        getScramble();
    }, [time, scramble, addSolve, getScramble]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.repeat) return;

        if (e.code === 'Space') {
            if (timerState === 'IDLE') {
                if (settings.solveInspection) {
                    setTimerState('INSPECTION');
                    setInspectionTime(15); // Reset inspection time
                } else {
                    primingStartRef.current = Date.now();
                    setTimerState('PRIMING');
                    setPrimingProgress(0);
                }
            } else if (timerState === 'INSPECTION') {
                primingStartRef.current = Date.now();
                setTimerState('PRIMING');
                setPrimingProgress(0);
            } else if (timerState === 'RUNNING') {
                finishSolve();
            } else if (timerState === 'SOLVED') {
                setTime(0);
                if (settings.solveInspection) {
                    setTimerState('INSPECTION');
                    setInspectionTime(15);
                } else {
                    primingStartRef.current = Date.now();
                    setTimerState('PRIMING');
                    setPrimingProgress(0);
                }
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
    }, [timerState, settings.primingLength, settings.solveInspection]);

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

    // Updated Opacity Logic from user:
    // Holding space (Priming 1) -> 0.6
    // Primed (Priming 2) -> 0.3
    // Released (Running) -> 0 ("Solve" text) or Visible time depending on setting
    const getContentOpacity = () => {
        if (timerState === 'PRIMING') {
            const isPrimed = primingProgress >= 1;
            return isPrimed ? 0.3 : 0.6;
        }
        if (timerState === 'RUNNING') {
            return 1; // Content wrapper is visible, but we switch what's inside
        }
        return 1;
    };

    const handleCopyScramble = () => {
        navigator.clipboard.writeText(scramble);
    };

    const handleNextScramble = () => {
        setScrambleRotation(prev => prev + 360);
        getScramble();
    };

    const changeScrambleSize = (delta: number) => {
        updateSettings({ scrambleSize: Math.max(0.8, Math.min(3, settings.scrambleSize + delta)) });
    };

    return (
        <div className="flex flex-col items-center justify-center h-full select-none transition-opacity duration-200" style={{ opacity: getContentOpacity() }}>

            {/* Scramble Toolbar */}
            <div className="flex items-center gap-4 mb-4 text-text-secondary">
                <button onClick={() => setScrambleVisible(!scrambleVisible)} className="hover:text-text-primary transition-colors" title={scrambleVisible ? "Hide Scramble" : "Show Scramble"}>
                    {scrambleVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>

                <button className="font-mono font-medium hover:text-text-primary transition-colors flex items-center gap-1">
                    3x3
                </button>

                <div className="flex items-center gap-1 bg-bg-secondary rounded p-1">
                    <button onClick={() => changeScrambleSize(-0.1)} className="hover:text-text-primary p-0.5"><Minus className="w-3 h-3" /></button>
                    <button onClick={() => changeScrambleSize(0.1)} className="hover:text-text-primary p-0.5"><Plus className="w-3 h-3" /></button>
                </div>

                <button onClick={handleCopyScramble} className="hover:text-text-primary transition-colors" title="Copy Scramble">
                    <Copy className="w-5 h-5" />
                </button>

                <button onClick={handleNextScramble} className="hover:text-text-primary transition-transform duration-500 ease-in-out" style={{ transform: `rotate(${scrambleRotation}deg)` }} title="Next Scramble">
                    <ChevronRight className="w-6 h-6" />
                </button>

                <Link to="/about" className="hover:text-text-primary transition-colors" title="Scramble Info">
                    <Info className="w-5 h-5" />
                </Link>
            </div>

            <div className="mb-10 text-center max-w-2xl min-h-[4rem] flex items-center justify-center">
                {scrambleVisible ? (
                    <p className="font-mono text-text-secondary leading-relaxed text-center" style={{ fontSize: `${settings.scrambleSize}rem` }}>
                        {scramble}
                    </p>
                ) : (
                    <p className="font-mono text-text-secondary/50 italic">Scramble hidden</p>
                )}
            </div>

            <div className="text-center">
                {timerState === 'INSPECTION' ? (
                    <h1 className={`text-9xl font-bold font-mono ${inspectionTime < 0 ? 'text-red-500' : 'text-accent'}`}>
                        {Math.abs(inspectionTime)}
                    </h1>
                ) : timerState === 'RUNNING' ? (
                    settings.showLiveTimer ? (
                        <h1 className={`text-9xl font-bold font-mono text-text-primary`}>
                            {Math.floor(time / 1000)} {/* Whole numbers as requested? "whole number current solve time" */}
                        </h1>
                    ) : (
                        <h1 className={`text-9xl font-bold font-mono text-text-primary tracking-widest`}>
                            SOLVE
                        </h1>
                    )
                ) : (
                    <h1 className={`text-9xl font-bold font-mono text-text-primary`}>
                        {formatTime(time)}
                    </h1>
                )}

                <div className="mt-8 text-text-secondary h-6">
                    {timerState === 'IDLE' && <p>Press & Hold Space to Start</p>}
                    {timerState === 'INSPECTION' && <p>Inspect! Press & Hold Space to Start</p>}
                    {timerState === 'PRIMING' && (
                        primingProgress >= 1
                            ? <p className="text-accent font-bold">READY</p>
                            : <p>Hold...</p>
                    )}
                    {timerState === 'SOLVED' && <p>Press Space to reset</p>}
                </div>
            </div>
        </div>
    );
}
