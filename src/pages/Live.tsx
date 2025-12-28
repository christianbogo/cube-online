import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { randomScrambleForEvent } from 'cubing/scramble';
import { useSettings } from '../contexts/SettingsContext';
import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import { EyeOff, Info, Minus, Plus, Search, Star, Ban, ChevronUp, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { rtdb } from '../lib/firebase';
import { ref, onDisconnect, set, onValue, remove } from 'firebase/database';
import { formatTime } from '../utils/formatTime';

type TimerState = 'IDLE' | 'INSPECTION' | 'PRIMING' | 'RUNNING' | 'SOLVED';

interface SimpleSolve {
    time: number;
    penalty: 'none' | '+2' | 'DNF';
    inspectionPenalty?: 'none' | '+2' | 'DNF';
    daily: string | null;
    timestamp: number;
}

interface LiveUser {
    uid: string;
    username: string;
    color: string;
    status: TimerState;
    lastSolveTime?: number;
    recentSolves?: SimpleSolve[];
    timestamp: number;
}

export default function Live() {
    const { settings, updateSettings } = useSettings();
    const { addSolve, currentScramble, setCurrentScramble, solves, isPrivateMode } = useSolves();
    const { startNewSession, currentSessionId } = useSession();
    const { user, toggleStarUser, toggleBlockUser } = useAuth();
    const [autoSessionToastVisible, setAutoSessionToastVisible] = useState(false);

    // Live User Data
    const [connectedUsers, setConnectedUsers] = useState<LiveUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [bottomBarCollapsed, setBottomBarCollapsed] = useState(false);

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

    const [specialType, setSpecialType] = useState<'normal' | 'y' | 'm' | 'w' | 'd' | 'h'>('normal');
    const [specialId, setSpecialId] = useState<string | null>(null);

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
        if (!user) return;

        const userPresenceRef = ref(rtdb, `presence/${user.uid}`);
        const currentRecent = formatRecentSolves();

        // Set initial data and onDisconnect
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
    }, [user, timerState, solves, formatRecentSolves]);

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
            // Check for special scramble first if user is logged in AND NOT PRIVATE
            if (user && !isPrivateMode) {
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
            daily: specialType !== 'normal' ? specialId : null,
            inspectionPenalty: finalInspectionPenalty
        });

        if (specialType !== 'normal' && user && specialId && !isPrivateMode) {
            import('../utils/dailyScramble').then(({ markScrambleComplete }) => {
                markScrambleComplete(user.uid, specialType, specialId);
            });
        }

        generateNewScramble();
    }, [time, scramble, addSolve, generateNewScramble, inspectionTime, specialType, specialId, user, isPrivateMode]);

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

    // Filter and Sort Connected Users
    const { favoriteUsers, communityUsers } = useMemo(() => {
        if (!user) return { favoriteUsers: [], communityUsers: [] };
        const starred = user.starredUsers || [];
        const blocked = user.blockedUsers || [];
        const q = searchQuery.toLowerCase();

        // Base filter: Not blocked, Main User not in list (handled by connectedUsers init logic but safe to double check if needed)
        // connectedUsers already filters out self.

        const allowed = connectedUsers.filter(u => !blocked.includes(u.uid));

        // Group
        const favs = allowed.filter(u => starred.includes(u.uid));
        const comms = allowed.filter(u => !starred.includes(u.uid));

        // Filter Community by Search (Favorites always show? Or search filters both? "Search... to find users" usually implies general find)
        // Let's filter community only by search to keep favorites accessible, or filter both if user intends to find specific person.
        // Usually favorites are "pinned", so maybe they stay?
        // Let's filter both for consistency if query exists.

        const filterFn = (u: LiveUser) => u.username.toLowerCase().includes(q);

        return {
            favoriteUsers: favs.filter(filterFn),
            communityUsers: comms.filter(filterFn)
        };
    }, [connectedUsers, user, searchQuery]);

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

    return (
        <div className="flex flex-col h-full relative overflow-hidden">

            {/* FAVORITES BAR (Top) */}
            {favoriteUsers.length > 0 && (
                <div className="flex-shrink-0 border-b border-border bg-background/50 backdrop-blur-sm p-4 flex gap-4 overflow-x-auto items-center h-40">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500/20" /> {/* Subtle indicator this is Favs */}
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


            {/* MAIN TIMER AREA */}
            <div
                className="flex-1 flex flex-col items-center justify-center select-none min-h-0"
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
                    {/* Timer Display Logic Same as Before */}
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

            {/* FLOATING CONTROLS FOR BOTTOM BAR */}
            <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pointer-events-none">
                {/* Search Bar & Toggle - Centered above the bar */}
                <div className="pointer-events-auto flex flex-col items-center gap-2 mb-[calc(theme(height.40)+8px)] transition-all duration-300 transform"
                    style={{ transform: bottomBarCollapsed ? 'translateY(160px)' : 'translateY(0)' }}>

                    <div className="flex items-center gap-2 bg-bg-secondary/90 backdrop-blur border border-border rounded-full p-1 pl-3 pr-2 shadow-lg">
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

            {/* COMMUNITY BAR (Bottom) */}
            <div
                className={`flex-shrink-0 border-t border-border bg-background/50 backdrop-blur-sm flex gap-4 overflow-x-auto items-center transition-all duration-300 ease-in-out relative z-10
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
        </div>
    );
}


// --- SUB COMPONENTS ---

const UserCard = ({ user, isStarred, onStar, onBlock }: {
    user: LiveUser,
    isStarred: boolean,
    onStar: (id: string, e: React.MouseEvent) => void,
    onBlock: (id: string, e: React.MouseEvent) => void
}) => {

    // Determine Border Color based on Status
    const getBorderColor = (status: TimerState) => {
        switch (status) {
            case 'RUNNING': return 'border-green-500';
            case 'INSPECTION': return 'border-orange-500';
            case 'SOLVED': return 'border-blue-500';
            case 'PRIMING': return 'border-red-500'; // Or generic ready color?
            default: return 'border-border'; // Idle
        }
    };

    // Format Solves Display
    // 0: Most Recent (Large)
    // 1-3: Older (Small)
    const solves = user.recentSolves || [];
    const recent = solves[0];
    const history = solves.slice(1, 4);

    const formatTimeStr = (s: SimpleSolve) => {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return 'DNF';
        let t = s.time;
        if (s.penalty === '+2') t += 2000;
        if (s.inspectionPenalty === '+2') t += 2000;
        let str = formatTime(t);
        if (s.penalty === '+2' || s.inspectionPenalty === '+2') str += '+';
        return str;
    };

    const isDaily = (s: SimpleSolve | undefined) => !!s?.daily;

    return (
        <div className={`flex-shrink-0 w-44 h-32 bg-surface-elevation-1 rounded-xl border-2 flex flex-col relative group hover:shadow-lg transition-all
            ${getBorderColor(user.status)}`}
        >
            {/* Header: Avatar + Name + Actions */}
            <div className="flex items-center justify-between p-2 pl-3 pb-1">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: user.color }} />
                    <span className="font-semibold text-text-primary truncate text-xs">{user.username}</span>
                    {isStarred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                </div>

                {/* Actions (Visible on Hover) */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => onStar(user.uid, e)}
                        className="text-text-secondary hover:text-yellow-500 p-0.5"
                        title={isStarred ? "Unstar" : "Star User"}
                    >
                        <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                    </button>
                    <button
                        onClick={(e) => onBlock(user.uid, e)}
                        className="text-text-secondary hover:text-red-500 p-0.5"
                        title="Block User"
                    >
                        <Ban className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Solves Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-2 pt-0 gap-1">

                {/* Main (Recent) Solve */}
                {recent ? (
                    <div className={`text-3xl font-mono font-medium tracking-tight
                        ${isDaily(recent) ? 'text-accent' : 'text-text-primary'}
                        ${recent.penalty === 'DNF' ? 'text-red-500' : ''}
                    `}>
                        {formatTimeStr(recent)}
                    </div>
                ) : (
                    <div className="text-2xl text-text-secondary/20 font-mono">--.--</div>
                )}

                {/* History (Small) */}
                <div className="flex gap-2 mt-1">
                    {[0, 1, 2].map(i => {
                        const s = history[i];
                        if (!s) return <div key={i} className="w-8 h-4 bg-black/10 rounded" />; // Placeholder
                        return (
                            <div key={i} className={`text-[10px] font-mono px-1 rounded
                                ${isDaily(s) ? 'text-accent bg-accent/10' : 'text-text-secondary bg-black/20'}
                                ${s.penalty === 'DNF' ? 'text-red-500' : ''}
                            `}>
                                {formatTimeStr(s)}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
