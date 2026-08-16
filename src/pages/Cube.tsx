import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { randomScrambleForEvent } from 'cubing/scramble';
import { useSettings } from '../contexts/SettingsContext';
import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import { useEconomy } from '../contexts/EconomyContext';
import {
    EyeOff,
    Minus,
    Plus,
    Radio,
    Search,
    ChevronUp,
    ChevronDown,
    Coins,
    Flame,
    HeartCrack,
    Dices,
    Trophy,
    Sparkles,
    HelpCircle,
    X
} from 'lucide-react';
import { formatTime } from '../utils/formatTime';
import { calculateAverage, calculateBestSingle } from '../utils/calculations';
import { rtdb } from '../lib/firebase';
import { ref, onDisconnect, set, onValue, remove } from 'firebase/database';
import type { LiveUser, SimpleSolve, TimerState } from '../types';
import { UserCard } from '../components';
import { soundEngine, type SoundPackType } from '../utils/soundEngine';

export default function Cube() {
    const { settings, updateSettings } = useSettings();
    const { solves, addSolve, currentScramble, setCurrentScramble } = useSolves();
    const { startNewSession, currentSessionId } = useSession();
    const { user, toggleStarUser, toggleBlockUser } = useAuth();
    const {
        economy,
        activeAlert,
        dismissAlert,
        processSolveGambling,
        bankStreakPot,
        toggleLetItRide,
        placeWager,
        cancelWager
    } = useEconomy();

    const scrambleType = settings.scrambleType;

    // Live Mode State
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [connectedUsers, setConnectedUsers] = useState<LiveUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [bottomBarCollapsed, setBottomBarCollapsed] = useState(false);

    // Wagering Modal State
    const [wagerModalOpen, setWagerModalOpen] = useState(false);
    const [wagerAmountInput, setWagerAmountInput] = useState<number>(25);
    const [customTargetSeconds, setCustomTargetSeconds] = useState<string>('');

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
    const prevTimerStateRef = useRef<TimerState>('IDLE');

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

    // Active session solves & averages for odds calculation
    const sessionSolves = useMemo(() => {
        if (!currentSessionId) return solves;
        return solves.filter(s => s.sessionId === currentSessionId);
    }, [solves, currentSessionId]);

    const sessionAvg = useMemo((): number | null => {
        const ao5 = calculateAverage(sessionSolves, 5);
        if (typeof ao5 === 'number') return ao5;
        if (sessionSolves.length > 0) {
            const mean = calculateAverage(sessionSolves, sessionSolves.length);
            if (typeof mean === 'number') return mean;
        }
        return null;
    }, [sessionSolves]);

    const personalBestSingle = useMemo((): number | null => {
        const pb = calculateBestSingle(solves);
        return typeof pb === 'number' ? pb : null;
    }, [solves]);

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
                color: user.color || economy.equippedColor || '#ef4444',
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
    }, [user, timerState, solves, formatRecentSolves, isLiveMode, economy.equippedColor]);

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

    // Inspection Logic & Audio Alerts
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
                        if (prev !== remaining) {
                            if (remaining === 8) soundEngine.playInspectionAlert('8s');
                            if (remaining === 3) soundEngine.playInspectionAlert('12s');
                            return remaining;
                        }
                        return prev;
                    });
                }
            }, 100);
        }

        return () => clearInterval(interval);
    }, [timerState]);

    // Priming Audio & Animation Loop
    useEffect(() => {
        let reqId: number;
        const updatePriming = () => {
            if (primingStartRef.current !== null) {
                const elapsed = (Date.now() - primingStartRef.current) / 1000;
                const progress = Math.min(elapsed / settings.primingLength, 1);
                setPrimingProgress(progress);
                soundEngine.playPriming(progress);
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

    // Finish Solve & Trigger Gambling Mechanics
    const finishSolve = useCallback(() => {
        setTimerState('SOLVED');
        setPrimingProgress(0);

        const soundPack = (economy.equippedCosmetics.sound || 'classic') as SoundPackType;
        soundEngine.playStop(soundPack);

        let finalInspectionPenalty: 'none' | '+2' | 'DNF' = 'none';
        finalInspectionPenalty = initialPenaltyRef.current;

        const isDNF = finalInspectionPenalty === 'DNF';
        const isPlusTwo = finalInspectionPenalty === '+2';

        addSolve({
            id: crypto.randomUUID(),
            time: time,
            scramble: scramble,
            date: new Date().toISOString(),
            penalty: 'none',
            inspectionTime: inspectionUsedRef.current || (15 - inspectionTime),
            inspectionPenalty: finalInspectionPenalty,
            scrambleType: scrambleType
        });

        // Run Push-Your-Luck, Wagers, and Near-Miss pity evaluations
        processSolveGambling(time, isDNF, isPlusTwo, sessionAvg, personalBestSingle);

        generateNewScramble();
    }, [
        time,
        scramble,
        addSolve,
        generateNewScramble,
        inspectionTime,
        scrambleType,
        economy.equippedCosmetics.sound,
        sessionAvg,
        personalBestSingle,
        processSolveGambling
    ]);

    // Keyboard handlers
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.repeat) return;
        if (wagerModalOpen) {
            if (e.key === 'Escape') {
                setWagerModalOpen(false);
            }
            return;
        }

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
    }, [timerState, settings.solveInspection, finishSolve, wagerModalOpen]);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        if (e.code === 'Space') {
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

                    const soundPack = (economy.equippedCosmetics.sound || 'classic') as SoundPackType;
                    soundEngine.playStart(soundPack);
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
    }, [timerState, settings.primingLength, settings.solveInspection, inspectionTime, economy.equippedCosmetics.sound]);

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

    // Wager Odds Calculator Presets
    const wagerOptions = useMemo(() => {
        const avg = sessionAvg ? sessionAvg / 1000 : 15.0;
        const pb = personalBestSingle ? personalBestSingle / 1000 : Math.max(8.0, avg * 0.7);

        return [
            {
                id: 'safe',
                label: `Sub-${(avg + 1.0).toFixed(2)}s`,
                targetMs: Math.round((avg + 1.0) * 1000),
                odds: 1.3,
                tier: 'Safe Bet',
                desc: 'Generous margin over session average.'
            },
            {
                id: 'par',
                label: `Sub-${avg.toFixed(2)}s`,
                targetMs: Math.round(avg * 1000),
                odds: 2.0,
                tier: 'Even Money',
                desc: 'Beat your current session average.'
            },
            {
                id: 'fast',
                label: `Sub-${Math.max(pb + 0.5, avg - 1.0).toFixed(2)}s`,
                targetMs: Math.round(Math.max(pb + 0.5, avg - 1.0) * 1000),
                odds: 4.0,
                tier: 'Fast Pace',
                desc: 'Pushing for a top-tier solve.'
            },
            {
                id: 'god',
                label: `Sub-${(pb + 0.2).toFixed(2)}s`,
                targetMs: Math.round((pb + 0.2) * 1000),
                odds: 10.0,
                tier: 'God Solve',
                desc: 'Near personal record territory.'
            },
            {
                id: 'pb_buster',
                label: `Sub-${pb.toFixed(2)}s (PB)`,
                targetMs: Math.round(pb * 1000),
                odds: 25.0,
                tier: 'PB Buster',
                desc: 'Set a brand new all-time Personal Best!'
            }
        ];
    }, [sessionAvg, personalBestSingle]);

    const handlePlacePresetWager = (opt: typeof wagerOptions[0]) => {
        const success = placeWager(wagerAmountInput, opt.targetMs, opt.odds, opt.label);
        if (success) {
            setWagerModalOpen(false);
        }
    };

    const handlePlaceCustomWager = () => {
        const num = parseFloat(customTargetSeconds);
        if (isNaN(num) || num <= 0) return;
        const targetMs = Math.round(num * 1000);

        // Dynamic odds formula based on session average
        const avg = sessionAvg || 15000;
        const diffRatio = (avg - targetMs) / avg;
        let odds = 2.0;
        if (diffRatio < -0.1) odds = 1.25;
        else if (diffRatio <= 0.05) odds = 2.0;
        else if (diffRatio <= 0.2) odds = 4.5;
        else if (diffRatio <= 0.35) odds = 12.0;
        else odds = 30.0;

        const success = placeWager(wagerAmountInput, targetMs, odds, `Sub-${num.toFixed(2)}s`);
        if (success) {
            setWagerModalOpen(false);
        }
    };

    // Scramble Visualizer Skin styling
    const cubeSkin = economy.equippedCosmetics.cubeSkin || 'stickerless';

    return (
        <div className={`flex flex-col h-full relative overflow-hidden ${economy.equippedCosmetics.theme || ''}`}>

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
                {/* GAMBLING HUD BAR (Streak & Wager Controls) */}
                <div className="w-full max-w-2xl px-4 mb-4 flex items-center justify-between gap-3 animate-in fade-in duration-300">
                    {/* Push-Your-Luck Streak Multiplier Widget */}
                    <div className="flex items-center gap-2 bg-bg-secondary/80 backdrop-blur-sm border border-border/80 rounded-2xl p-2 px-3.5 shadow-sm">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                            economy.streak.isRiding
                                ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30 animate-pulse'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                            {economy.streak.isRiding ? <Flame className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
                        </div>

                        <div className="text-left">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-text-primary font-mono">
                                    {economy.streak.currentPot} Coins
                                </span>
                                {economy.streak.count > 1 && (
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-orange-500/20 text-orange-400 rounded-md">
                                        x{Math.pow(2, economy.streak.count - 1)} Multiplier
                                    </span>
                                )}
                            </div>
                            {economy.streak.isRiding && (
                                <div className="text-[10px] text-text-secondary">
                                    Letting it Ride! (Beat {sessionAvg ? (sessionAvg / 1000).toFixed(2) + 's' : 'Average'})
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 ml-2">
                            {economy.streak.currentPot > 0 && (
                                <button
                                    onClick={bankStreakPot}
                                    disabled={timerState === 'RUNNING' || timerState === 'PRIMING'}
                                    className="px-2.5 py-1 bg-bg-hover hover:bg-border text-text-primary text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    title="Bank current pot to wallet"
                                >
                                    Bank
                                </button>
                            )}

                            <button
                                onClick={toggleLetItRide}
                                disabled={timerState === 'RUNNING' || timerState === 'PRIMING'}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 ${
                                    economy.streak.isRiding
                                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 animate-pulse'
                                        : 'bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary'
                                }`}
                                title="Risk pot on next solve for 2x multiplier"
                            >
                                <Flame className="w-3 h-3" />
                                <span>{economy.streak.isRiding ? 'Riding 2x' : 'Let it Ride'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Performance Wagering Badge / Trigger */}
                    <div>
                        {economy.activeWager ? (
                            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-400 animate-pulse">
                                <Dices className="w-4 h-4" />
                                <span>Wager: {economy.activeWager.targetLabel} ({economy.activeWager.potentialPayout} Coins)</span>
                                <button
                                    onClick={cancelWager}
                                    disabled={timerState === 'RUNNING' || timerState === 'PRIMING'}
                                    className="ml-1 p-0.5 hover:bg-emerald-500/20 rounded cursor-pointer disabled:opacity-50"
                                    title="Cancel Wager"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setWagerModalOpen(true)}
                                disabled={timerState === 'RUNNING' || timerState === 'PRIMING'}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-bg-secondary hover:bg-bg-hover border border-border rounded-xl text-xs font-bold text-text-primary transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Dices className="w-4 h-4 text-accent" />
                                <span>Bet on Yourself</span>
                            </button>
                        )}
                    </div>
                </div>

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

                            <button onClick={() => setScrambleVisible(false)} className="hover:text-accent transition-colors" title="Hide Scramble">
                                <EyeOff className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-4">
                                <button onClick={() => changeScrambleSize(-0.4)} className="hover:text-accent transition-colors" title="Smaller">
                                    <Minus className="w-5 h-5" />
                                </button>
                                <button onClick={() => changeScrambleSize(0.4)} className="hover:text-accent transition-colors" title="Larger">
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Scramble Text with Equipped Cube Skin Header */}
                        <div className="mb-8 text-center max-w-2xl min-h-[4rem] flex flex-col items-center justify-center">
                            {cubeSkin !== 'stickerless' && (
                                <div className="mb-2 text-[10px] uppercase font-mono tracking-widest text-text-secondary/60 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-accent" />
                                    <span>Visualizer: {cubeSkin} Skin</span>
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
                        <h1 className="text-9xl font-normal font-mono text-text-primary">
                            {formatTime(time)}
                        </h1>
                    )}
                </div>

                {/* Equipped Title Subtitle */}
                {economy.equippedCosmetics.title && (
                    <div className="mt-4 text-xs font-mono font-medium text-text-secondary/50 tracking-wider">
                        {economy.equippedCosmetics.title}
                    </div>
                )}
            </div>

            {/* WAGERING DIALOG MODAL */}
            {wagerModalOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setWagerModalOpen(false)}
                >
                    <div
                        className="bg-bg-secondary border border-border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Dices className="w-6 h-6 text-accent" />
                                <h3 className="text-lg font-bold text-text-primary">Performance Wagering</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link
                                    to="/guide"
                                    className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 p-1 rounded hover:bg-accent/10"
                                    title="View Rules & Odds"
                                >
                                    <HelpCircle className="w-4 h-4" />
                                    <span>Rules</span>
                                </Link>
                                <button onClick={() => setWagerModalOpen(false)} className="p-1 text-text-secondary hover:text-text-primary rounded cursor-pointer">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <p className="text-xs text-text-secondary mb-6">
                            Put your coins on the line before the scramble. Beat your target time to multiply your payout!
                        </p>

                        {/* Wager Bet Amount Selector */}
                        <div className="mb-6">
                            <label className="text-xs uppercase font-bold text-text-secondary block mb-2">Bet Amount (Coins)</label>
                            <div className="flex items-center gap-2 mb-2">
                                {[10, 25, 50, 100, 250].map(val => (
                                    <button
                                        key={val}
                                        onClick={() => setWagerAmountInput(val)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer ${
                                            wagerAmountInput === val
                                                ? 'bg-accent text-white'
                                                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        {val}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setWagerAmountInput(economy.coins)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer"
                                >
                                    MAX
                                </button>
                            </div>

                            <input
                                type="number"
                                min="1"
                                max={economy.coins}
                                value={wagerAmountInput}
                                onChange={e => setWagerAmountInput(Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-full bg-bg-primary border border-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-accent"
                            />
                        </div>

                        {/* Dynamic Odds Presets */}
                        <div className="space-y-2.5 mb-6">
                            <label className="text-xs uppercase font-bold text-text-secondary block">Select Target Time & Odds</label>
                            {wagerOptions.map((opt) => {
                                const payout = Math.round(wagerAmountInput * opt.odds);
                                const canAfford = economy.coins >= wagerAmountInput;

                                return (
                                    <div
                                        key={opt.id}
                                        onClick={() => canAfford && handlePlacePresetWager(opt)}
                                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                                            canAfford
                                                ? 'bg-bg-primary border-border hover:border-accent hover:shadow-md'
                                                : 'bg-bg-primary/50 border-border/40 opacity-50 cursor-not-allowed'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-text-primary font-mono">{opt.label}</span>
                                                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                                                    {opt.tier}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-text-secondary mt-0.5">{opt.desc}</div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-xs font-bold text-emerald-400 font-mono">{opt.odds}x Payout</div>
                                            <div className="text-[11px] font-mono text-text-secondary">+{payout} Coins</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Custom Target Input */}
                        <div className="pt-4 border-t border-border/40 flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Custom target (e.g. 14.5)"
                                value={customTargetSeconds}
                                onChange={e => setCustomTargetSeconds(e.target.value)}
                                className="flex-1 bg-bg-primary border border-border rounded-xl px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
                            />
                            <button
                                onClick={handlePlaceCustomWager}
                                disabled={!customTargetSeconds || economy.coins < wagerAmountInput}
                                className="px-4 py-2 bg-text-primary text-bg-primary text-xs font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                            >
                                Place Custom
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GAMBLING ALERT MODAL / TOAST OVERLAY */}
            {activeAlert && (
                <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className={`p-4 rounded-2xl border shadow-2xl max-w-sm flex items-start gap-3.5 backdrop-blur-md ${
                        activeAlert.type === 'near_miss'
                            ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                            : activeAlert.type === 'wager_win' || activeAlert.type === 'streak_win'
                            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                            : 'bg-bg-secondary border-border text-text-primary'
                    }`}>
                        <div className="p-2 rounded-xl bg-white/10 shrink-0">
                            {activeAlert.type === 'near_miss' && <HeartCrack className="w-5 h-5 text-rose-400" />}
                            {activeAlert.type === 'wager_win' && <Trophy className="w-5 h-5 text-emerald-400" />}
                            {activeAlert.type === 'wager_loss' && <Dices className="w-5 h-5 text-zinc-400" />}
                            {activeAlert.type === 'streak_win' && <Flame className="w-5 h-5 text-orange-400" />}
                            {activeAlert.type === 'streak_bust' && <Flame className="w-5 h-5 text-red-400" />}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm leading-tight mb-1">{activeAlert.title}</h4>
                            <p className="text-xs opacity-80 leading-normal">{activeAlert.subtitle}</p>
                        </div>

                        <button onClick={dismissAlert} className="p-1 hover:bg-white/10 rounded shrink-0 cursor-pointer">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

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
        </div>
    );
}
