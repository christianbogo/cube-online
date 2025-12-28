import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { randomScrambleForEvent } from 'cubing/scramble';
import { useSettings } from '../contexts/SettingsContext';
import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import { EyeOff, Info, Minus, Plus, ChevronDown, Radio, Search, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatTime } from '../utils/formatTime';
import { rtdb } from '../lib/firebase';
import { ref, onDisconnect, set, onValue, remove } from 'firebase/database';
import type { LiveUser, SimpleSolve, TimerState } from '../types/liveTypes';
import { UserCard } from '../components/UserCard';

const SCRAMBLE_TYPES = [
    { label: '3x3', value: '333' },
    { label: '2x2', value: '222' },
    { label: '4x4', value: '444' },
    { label: '5x5', value: '555' },
    { label: '6x6', value: '666' },
    { label: '7x7', value: '777' },
    { label: 'Clock', value: 'clock' },
    { label: 'Mega', value: 'minx' },
    { label: 'Pyra', value: 'pyram' },
    { label: 'Skewb', value: 'skewb' },
    { label: 'Sq-1', value: 'sq1' },
];

export default function Cube() {
    const { settings, updateSettings } = useSettings();
    const { isPrivateMode, solves, addSolve, currentScramble, setCurrentScramble } = useSolves();
    const { startNewSession, currentSessionId } = useSession();
    const { user, toggleStarUser, toggleBlockUser } = useAuth();

    // Scramble Type State
    const [scrambleType, setScrambleType] = useState<string>(() => {
        return localStorage.getItem('cutter-cubing-scramble-type') || '333';
    });

    useEffect(() => {
        localStorage.setItem('cutter-cubing-scramble-type', scrambleType);
    }, [scrambleType]);

    // Live Mode State
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [connectedUsers, setConnectedUsers] = useState<LiveUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [bottomBarCollapsed, setBottomBarCollapsed] = useState(false);

    // Check if we need to start a new session on type change
    const checkSessionConsistency = useCallback(async () => {
        if (!currentSessionId) return;

        // Find solves in current session
        const sessionSolves = solves.filter(s => s.sessionId === currentSessionId);
        if (sessionSolves.length === 0) return;

        // If the last solve (or any in session, but usually session is homogenous) has diff type
        const lastSolve = sessionSolves[0];
        const lastType = lastSolve.scrambleType || '333';

        if (lastType !== scrambleType) {
            // Start new session
            await startNewSession(false);
            // setAutoSessionToastVisible(true); // Removed popup as requested
        }
    }, [currentSessionId, solves, scrambleType, startNewSession]);

    // Verify session on mount/change
    useEffect(() => {
        checkSessionConsistency();
    }, [scrambleType]);

    // Auto-create session logic (Silent now)
    useEffect(() => {
        if (user && !currentSessionId) {
            startNewSession(false);
        }
    }, [user, currentSessionId, startNewSession]);

    const [scramble, setScramble] = useState<string>(currentScramble || 'Generating scramble...');
    const [timerState, setTimerState] = useState<TimerState>('IDLE');
    const [time, setTime] = useState(0);
    const [inspectionTime, setInspectionTime] = useState(15);
    const [primingProgress, setPrimingProgress] = useState(0); // 0 to 1
    const [scrambleVisible, setScrambleVisible] = useState(true);
    const [isCopied, setIsCopied] = useState(false);

    const startTimeRef = useRef<number>(0);
    const primingStartRef = useRef<number | null>(null);
    const initialPenaltyRef = useRef<Solve['penalty']>('none');
    const prevTimerStateRef = useRef<TimerState>('IDLE');

    const inspectionStartTimeRef = useRef<number | null>(null);
    const inspectionUsedRef = useRef<number>(0); // Store exact inspection time used (ms)

    const [specialType, setSpecialType] = useState<'normal' | 'y' | 'm' | 'w' | 'd' | 'h'>('normal');
    const [specialId, setSpecialId] = useState<string | null>(null);

    // --- Live Mode Logic ---

    // Helper to format solves for broadcast (Last 4)
    const formatRecentSolves = useCallback((): SimpleSolve[] => {
        return solves.slice(0, 4).map(s => ({
            time: s.time,
            penalty: s.penalty,
            inspectionPenalty: s.inspectionPenalty,
            daily: s.daily || null,
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
                color: user.color || '#3b82f6',
                status: timerState,
                lastSolveTime: solves.length > 0 ? solves[0].time : undefined,
                recentSolves: currentRecent,
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
            recentSolves: currentRecent,
            timestamp: Date.now()
        });

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

    // Filter and Sort Connected Users
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


    // Fetch new scramble
    const generateNewScramble = useCallback(async () => {
        try {
            // Check for special scramble first if user is logged in AND NOT PRIVATE
            if (user && !isPrivateMode && scrambleType === '333') { // Only check special if 3x3
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

            const s = await randomScrambleForEvent(scrambleType);
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
    }, [setCurrentScramble, user, isPrivateMode, scrambleType]);

    useEffect(() => {
        generateNewScramble();
    }, [scrambleType]); // Re-generate when type changes

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

    const finishSolve = useCallback(() => {
        setTimerState('SOLVED');
        setPrimingProgress(0);

        let finalInspectionPenalty: 'none' | '+2' | 'DNF' = 'none';
        finalInspectionPenalty = initialPenaltyRef.current;

        addSolve({
            id: crypto.randomUUID(),
            time: time,
            scramble: scramble,
            date: new Date().toISOString(),
            penalty: 'none', // Manual penalty starts as none
            inspectionTime: inspectionUsedRef.current || (15 - inspectionTime), // Use precise ref, fallback to state
            daily: specialType !== 'normal' ? specialId : null,
            inspectionPenalty: finalInspectionPenalty,
            scrambleType: scrambleType
        });
        if (specialType !== 'normal' && user && specialId && !isPrivateMode) {
            // Dynamic import
            import('../utils/dailyScramble').then(({ markScrambleComplete }) => {
                markScrambleComplete(user.uid, specialType, specialId);
            });
        }
        generateNewScramble();
    }, [time, scramble, addSolve, generateNewScramble, inspectionTime, specialType, user, specialId, isPrivateMode, scrambleType]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.repeat) return;

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
        if (inspectionTime > 7) return 'text-text-primary'; // 15-8 (Black/Default)
        if (inspectionTime > 3) return 'text-orange-500';   // 7-4 (Orange)
        return 'text-red-500';                              // 3+ (Red)
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
        switch (scrambleType) {
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

    // Special Formatting for Running Timer > 59s
    const formatRunningTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return seconds.toString();

        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full relative overflow-hidden">

            {/* FAVORITES BAR (Top) - Only in Live Mode */}
            {isLiveMode && favoriteUsers.length > 0 && (
                <div className="flex-shrink-0 border-b border-border bg-background/50 backdrop-blur-sm p-4 flex gap-4 overflow-x-auto items-center h-40 animate-in slide-in-from-top-4 fade-in duration-300">
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

            <div
                className="flex-1 flex flex-col items-center justify-center select-none min-h-0"
                style={{ opacity: (timerState === 'PRIMING' && primingProgress < 1) ? 0.6 : 1 }}
            >

                {/* Scramble Toolbar & Content */}
                {scrambleVisible ? (
                    <>
                        <div className="flex items-center gap-6 mb-4 text-text-secondary transition-opacity hover:text-text-primary">

                            {/* Live Toggle */}
                            <button
                                onClick={() => setIsLiveMode(!isLiveMode)}
                                className={`flex items-center gap-1 transition-colors ${isLiveMode ? 'text-red-500 hover:text-red-400' : 'hover:text-accent'}`}
                                title={isLiveMode ? "Disable Live Mode" : "Enable Live Mode"}
                            >
                                <Radio className={`w-5 h-5 ${isLiveMode ? 'animate-pulse' : ''}`} />
                                {isLiveMode && <span className="text-xs font-bold uppercase tracking-widest">LIVE</span>}
                            </button>

                            <div className="w-[1px] h-5 bg-border/50" />

                            {/* Scramble Type Selector */}
                            <div className="relative group">
                                <select
                                    value={scrambleType}
                                    onChange={(e) => setScrambleType(e.target.value)}
                                    className="appearance-none bg-transparent font-medium border-b border-white/10 hover:border-accent
                                            focus:outline-none focus:border-accent pl-2 pr-6 py-1 cursor-pointer text-center text-sm"
                                >
                                    {SCRAMBLE_TYPES.map(opt => (
                                        <option key={opt.value} value={opt.value} className="bg-bg-secondary text-text-primary">
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover:opacity-100" />
                            </div>

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
                            <p
                                onClick={handleCopyScramble}
                                className="font-mono text-text-secondary leading-relaxed text-center transition-all cursor-pointer hover:text-text-primary active:scale-95"
                                style={{ fontSize: `${settings.scrambleSize * getScrambleSizeMultiplier()}rem` }}
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
                                {formatRunningTime(time)}
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
            </div>

            {/* FLOATING CONTROLS FOR BOTTOM BAR (Live Mode Only) */}
            {isLiveMode && (
                <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Search Bar & Toggle - Centered above the bar */}
                    <div className="pointer-events-auto flex flex-col items-center gap-2 mb-[calc(theme(height.40)+8px)] transition-all duration-300 transform"
                        style={{ transform: bottomBarCollapsed ? 'translateY(160px)' : 'translateY(0)' }}>

                        <div className="flex items-center gap-2 bg-bg-secondary/90 backdrop-blur border border-border rounded-full p-1 pl-3 pr-2">
                            <Search className="w-3.5 h-3.5 text-text-secondary" />
                            <input
                                type="text"
                                placeholder="Find user..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent w-32 text-xs focus:outline-none text-text-primary placeholder:text-text-secondary/50"
                            />
                            <div className="w-[1px] h-4 bg-border mx-1" />
                            <button
                                onClick={() => setBottomBarCollapsed(!bottomBarCollapsed)}
                                className="hover:bg-bg-tertiary p-1 rounded-full text-text-secondary hover:text-text-primary transition-colors"
                            >
                                {bottomBarCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* COMMUNITY BAR (Bottom) (Live Mode Only) */}
            {isLiveMode && (
                <div
                    className={`flex-shrink-0 border-t border-border bg-background/50 backdrop-blur-sm flex gap-4 overflow-x-auto items-center transition-all duration-300 ease-in-out relative z-10 animate-in slide-in-from-bottom-10 fade-in
                    ${bottomBarCollapsed ? 'h-0 opacity-0' : 'h-40 p-4'}`}
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
            )}
        </div>
    );
}
