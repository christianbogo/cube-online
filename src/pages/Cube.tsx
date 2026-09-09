import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { randomScrambleForEvent } from 'cubing/scramble';
import { useSettings } from '../contexts/SettingsContext';
import { useSolves, type Solve } from '../contexts/SolvesContext';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import { useGoals } from '../contexts/GoalsContext';
import { useLive } from '../contexts/LiveContext';
import { useEvents } from '../hooks/useEvents';
import { Link, useNavigate } from 'react-router-dom';
import {
    Search,
    CheckCircle2,
    X,
    Maximize2
} from 'lucide-react';
import { formatTime } from '../utils/formatTime';
import type { LiveUser, TimerState } from '../types';
import { UserCard, KeybindTooltip, UserAvatar, WcaBadge } from '../components';
import { hasLinkedWca } from '../utils/wca';
import { MOCK_FRIENDS, MOCK_COMMUNITY_USERS, USE_MOCK_USERS } from '../utils/mockLiveUsers';
import { useIsMobile } from '../utils/useIsMobile';
import MobileCube from '../components/mobile/MobileCube';

function DesktopCube() {
    const navigate = useNavigate();
    const { settings, updateSettings } = useSettings();
    const { solves, addSolve, updateSolve, currentScramble, setCurrentScramble } = useSolves();
    const { currentSessionId, setCurrentSessionId, checkSessionStatus } = useSession();
    const { user, toggleStarUser } = useAuth();
    const { pinnedGoals } = useGoals();
    const { isLiveMode, connectedUsers, setLiveTimerState } = useLive();
    const { getBaseScrambleType } = useEvents();

    const scrambleType = settings.scrambleType;

    // Guest solves reminder notification (every 5 solves)
    const [showGuestPrompt, setShowGuestPrompt] = useState(false);

    // Last finished solve tracking for 5s penalty shortcuts
    const lastFinishedSolveRef = useRef<{ id: string; timestamp: number } | null>(null);
    const [penaltyFeedback, setPenaltyFeedback] = useState<{ text: string; type: string } | null>(null);

    // Live Mode State
    const [searchQuery, setSearchQuery] = useState('');
    const bottomContainerRef = useRef<HTMLDivElement>(null);
    const [isBottomOverflowing, setIsBottomOverflowing] = useState(false);

    // Popular Mode Drag & Drop State
    const [popularPositions, setPopularPositions] = useState<Record<string, 'top' | 'bottom'>>(() => {
        try {
            const saved = localStorage.getItem('cube_popular_positions');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const moveUserPosition = useCallback((uid: string, target: 'top' | 'bottom') => {
        setPopularPositions(prev => {
            const next = { ...prev, [uid]: target };
            localStorage.setItem('cube_popular_positions', JSON.stringify(next));
            return next;
        });
    }, []);

    const [isTopDragOver, setIsTopDragOver] = useState(false);
    const [isBottomDragOver, setIsBottomDragOver] = useState(false);

    // Minimized / Hidden top friends chips
    const [hiddenUserIds, setHiddenUserIds] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('cube_hidden_live_users');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const hideUser = useCallback((uid: string) => {
        setHiddenUserIds(prev => {
            if (prev.includes(uid)) return prev;
            const next = [...prev, uid];
            localStorage.setItem('cube_hidden_live_users', JSON.stringify(next));
            return next;
        });
    }, []);

    const unhideUser = useCallback((uid: string) => {
        setHiddenUserIds(prev => {
            const next = prev.filter(id => id !== uid);
            localStorage.setItem('cube_hidden_live_users', JSON.stringify(next));
            return next;
        });
    }, []);

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
                // Last solve was within 10 minutes - keep current session going
                if (currentSessionId !== lastSolve.sessionId) {
                    setCurrentSessionId(lastSolve.sessionId);
                }
                return;
            }
        }

        // If no solve within 10 minutes for this scramble type,
        // and current session is either from a different scramble type or timed out, reset currentSessionId
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

    const [scramble, setScramble] = useState<string>(currentScramble || 'Generating scramble...');
    const [timerState, setTimerState] = useState<TimerState>('IDLE');
    const [time, setTime] = useState(0);
    const [inspectionTime, setInspectionTime] = useState(15);
    const [primingProgress, setPrimingProgress] = useState(0);
    const [isCopied, setIsCopied] = useState(false);

    // Sync timerState with LiveContext for RTDB broadcast
    useEffect(() => {
        setLiveTimerState(timerState);
        timerStateRef.current = timerState;
    }, [timerState, setLiveTimerState]);

    const startTimeRef = useRef<number>(0);
    const timerStateRef = useRef<TimerState>('IDLE');
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

    // Filter connected users (includes mock users for UI testing)
    const { favoriteUsers, communityUsers } = useMemo(() => {
        const starred = user?.following || user?.starredUsers || [];
        const blocked = user?.blockedUsers || [];
        const q = searchQuery.toLowerCase();

        const allowed = connectedUsers.filter(u => !blocked.includes(u.uid));
        const liveFavs = allowed.filter(u => starred.includes(u.uid));
        const liveComms = allowed.filter(u => !starred.includes(u.uid));

        const filterFn = (u: LiveUser) => u.username.toLowerCase().includes(q);

        // Include mock users for testing when USE_MOCK_USERS is true
        const mockFavs = USE_MOCK_USERS ? MOCK_FRIENDS : [];
        const mockComms = USE_MOCK_USERS ? MOCK_COMMUNITY_USERS : [];

        const combinedFavs = [...mockFavs, ...liveFavs];
        const combinedComms = [...mockComms, ...liveComms];

        const favsMap = new Map<string, LiveUser>();
        combinedFavs.forEach(u => {
            if (!blocked.includes(u.uid)) favsMap.set(u.uid, u);
        });

        const commsMap = new Map<string, LiveUser>();
        combinedComms.forEach(u => {
            if (!blocked.includes(u.uid) && !favsMap.has(u.uid) && filterFn(u)) {
                commsMap.set(u.uid, u);
            }
        });

        return {
            favoriteUsers: Array.from(favsMap.values()),
            communityUsers: Array.from(commsMap.values())
        };
    }, [connectedUsers, user, searchQuery]);

    // Split top followed users into visible cards and minimized chips
    const { visibleFavoriteUsers, hiddenFavoriteUsers } = useMemo(() => {
        const visible: LiveUser[] = [];
        const hidden: LiveUser[] = [];
        favoriteUsers.forEach(u => {
            if (hiddenUserIds.includes(u.uid)) {
                hidden.push(u);
            } else {
                visible.push(u);
            }
        });
        return { visibleFavoriteUsers: visible, hiddenFavoriteUsers: hidden };
    }, [favoriteUsers, hiddenUserIds]);

    const followerDisplay = settings.followerDisplay || 'default';

    const {
        topChips,
        topCards,
        bottomChips,
        bottomCards,
        hasTopUsers,
        hasBottomUsers
    } = useMemo(() => {
        if (followerDisplay === 'minimal') {
            return {
                topChips: [] as LiveUser[],
                topCards: visibleFavoriteUsers,
                bottomChips: hiddenFavoriteUsers,
                bottomCards: [] as LiveUser[],
                hasTopUsers: visibleFavoriteUsers.length > 0,
                hasBottomUsers: hiddenFavoriteUsers.length > 0
            };
        }

        if (followerDisplay === 'popular') {
            const tChips: LiveUser[] = [];
            const tCards: LiveUser[] = [];
            const bChips: LiveUser[] = [];
            const bCards: LiveUser[] = [];

            // Popular mode: ONLY followed cubers (favoriteUsers) at either top or bottom
            favoriteUsers.forEach(u => {
                const pos = popularPositions[u.uid] || 'top';
                const isHidden = hiddenUserIds.includes(u.uid);

                if (pos === 'top') {
                    if (isHidden) {
                        tChips.push(u);
                    } else {
                        tCards.push(u);
                    }
                } else {
                    if (isHidden) {
                        bChips.push(u);
                    } else {
                        bCards.push(u);
                    }
                }
            });

            return {
                topChips: tChips,
                topCards: tCards,
                bottomChips: bChips,
                bottomCards: bCards,
                hasTopUsers: favoriteUsers.length > 0,
                hasBottomUsers: favoriteUsers.length > 0
            };
        }

        // Default: Hidden chips at top, open cards also at top, unfollowed chips at bottom
        return {
            topChips: hiddenFavoriteUsers,
            topCards: visibleFavoriteUsers,
            bottomChips: communityUsers,
            bottomCards: [] as LiveUser[],
            hasTopUsers: hiddenFavoriteUsers.length > 0 || visibleFavoriteUsers.length > 0,
            hasBottomUsers: communityUsers.length > 0 || searchQuery.length > 0
        };
    }, [
        followerDisplay,
        visibleFavoriteUsers,
        hiddenFavoriteUsers,
        communityUsers,
        popularPositions,
        hiddenUserIds,
        favoriteUsers,
        searchQuery
    ]);

    // Scramble generation
    const generateNewScramble = useCallback(async () => {
        try {
            const baseScrambleType = getBaseScrambleType(scrambleType);
            if (baseScrambleType === 'none') {
                setScramble('No Scramble');
                setCurrentScramble('No Scramble');
                return;
            }
            const s = await randomScrambleForEvent(baseScrambleType);
            const scrambleStr = s.toString();
            setScramble(scrambleStr);
            setCurrentScramble(scrambleStr);
        } catch (e) {
            console.error(e);
            const fallback = "R U R' U'";
            setScramble(fallback);
            setCurrentScramble(fallback);
        }
    }, [setCurrentScramble, scrambleType, getBaseScrambleType]);

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

        // Trigger account creation prompt for guests every 5 solves
        if (!user) {
            const nextSolveCount = solves.length + 1;
            if (nextSolveCount > 0 && nextSolveCount % 5 === 0) {
                setShowGuestPrompt(true);
            }
        }

        generateNewScramble();
    }, [
        time,
        scramble,
        addSolve,
        generateNewScramble,
        inspectionTime,
        scrambleType,
        user,
        solves.length
    ]);

    // Keyboard handlers
    const isTextInputElement = (el: HTMLElement | null) => el && (
        (el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'submit', 'reset'].includes((el as HTMLInputElement).type)) ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable
    );

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (isTextInputElement(target) || isTextInputElement(document.activeElement as HTMLElement)) {
            return;
        }

        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            if (showGuestPrompt) {
                setShowGuestPrompt(false);
            }
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

            // Pass Scramble Shortcut ('p' or 'P')
            if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                generateNewScramble();
                return;
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
            if (e.key === 'y' || e.key === 'Y') { updateSettings({ scrambleType: 'pyram' }); return; }
            if (e.key === 'k' || e.key === 'K') { updateSettings({ scrambleType: 'skewb' }); return; }
            if (e.key === 'f' || e.key === 'F') { updateSettings({ scrambleType: 'fto' }); return; }
        }
    }, [timerState, settings.solveInspection, finishSolve, solves, updateSolve, updateSettings, generateNewScramble]);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (isTextInputElement(target) || isTextInputElement(document.activeElement as HTMLElement)) {
            return;
        }

        if (e.code === 'Space' || e.key === ' ') {
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

    const isNoScramble = getBaseScrambleType(scrambleType) === 'none' || scramble === 'No Scramble';

    const handleCopyScramble = () => {
        if (isNoScramble) return;
        navigator.clipboard.writeText(scramble);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const getScrambleSizeMultiplier = () => {
        switch (visualScrambleType) {
            case '444':
            case '555':
            case '444bf':
            case '555bf':
            case 'sq1':
            case 'fto':
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
        if (followerDisplay !== 'default') {
            setIsBottomOverflowing(false);
            return;
        }
        const check = () => {
            if (bottomContainerRef.current) {
                const containerWidth = bottomContainerRef.current.clientWidth;
                const totalEstimatedWidth = bottomChips.length * 120 + bottomCards.length * 180;
                setIsBottomOverflowing(totalEstimatedWidth > containerWidth);
            }
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [bottomChips, bottomCards, followerDisplay]);

    const formatRunningTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return seconds.toString();
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full relative overflow-hidden">

            {/* LIVE BAR (Top - Followed Cubers & Minimized Chips) */}
            {isLiveMode && hasTopUsers && (
                <div
                    className={`flex-shrink-0 w-full px-2 pt-1 pb-1 flex flex-col items-center gap-1.5 z-10 animate-in slide-in-from-top-4 fade-in duration-300 transition-all ${isTopDragOver ? 'bg-accent/10 rounded-xl border-2 border-dashed border-accent/40' : ''}`}
                    onDragOver={(e) => {
                        if (followerDisplay === 'popular') {
                            e.preventDefault();
                            setIsTopDragOver(true);
                        }
                    }}
                    onDragLeave={() => setIsTopDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsTopDragOver(false);
                        const uid = e.dataTransfer.getData('text/plain');
                        if (uid) moveUserPosition(uid, 'top');
                    }}
                >
                    {/* Empty Drop Zone for Popular Mode at Top */}
                    {followerDisplay === 'popular' && topCards.length === 0 && topChips.length === 0 && (
                        <div className={`py-2 px-6 rounded-xl border border-dashed text-xs text-text-secondary/50 transition-colors my-1 select-none ${isTopDragOver ? 'border-accent text-accent bg-accent/10' : 'border-border/30'}`}>
                            Drag cubers here to move to top
                        </div>
                    )}

                    {/* Top Minimized/Hidden Chips Row */}
                    {topChips.length > 0 && (
                        <div className="w-full flex items-center justify-center overflow-x-auto no-scrollbar py-1 px-4 mask-fade-edges">
                            <div className="flex items-center gap-2 flex-nowrap min-w-max mx-auto justify-center">
                                {topChips.map(u => (
                                    <button
                                        key={`hidden-top-${u.uid}`}
                                        type="button"
                                        draggable={followerDisplay === 'popular'}
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', u.uid)}
                                        onClick={() => unhideUser(u.uid)}
                                        className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 hover:border-accent/60 bg-bg-secondary/40 hover:bg-bg-secondary text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer group select-none shadow-2xs outline-none focus:outline-none"
                                        title={`Show ${u.username}'s card`}
                                    >
                                        <div className="w-3 h-3 relative flex items-center justify-center flex-shrink-0">
                                            <UserAvatar
                                                user={u}
                                                className="w-3 h-3 group-hover:scale-0 group-hover:opacity-0 transition-all duration-150"
                                                roundedClassName="rounded-sm"
                                            />
                                            <Maximize2 className="w-3 h-3 text-accent absolute inset-0 m-auto scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-150" />
                                        </div>
                                        <span className="font-medium truncate max-w-[110px]">{u.username}</span>
                                        {hasLinkedWca(u) && (
                                            <span
                                                title={`Verified WCA Competitor (${u.wcaId || 'Linked'})`}
                                                className="inline-flex items-center align-middle shrink-0"
                                            >
                                                <WcaBadge user={u} className="w-3 h-3 drop-shadow-2xs" />
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Open Cards Row */}
                    {topCards.length > 0 && (
                        <div className="w-full flex items-center overflow-x-auto min-h-[128px] sm:min-h-[144px] py-4 px-4 no-scrollbar mask-fade-edges-cards">
                            <div className="flex items-center gap-3 min-w-max mx-auto px-4 justify-center">
                                {topCards.map(u => (
                                    <UserCard
                                        key={u.uid}
                                        user={u}
                                        onHide={() => hideUser(u.uid)}
                                        draggable={followerDisplay === 'popular'}
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', u.uid)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MAIN TIMER STAGE */}
            <div
                className="flex-1 flex flex-col items-center justify-center select-none min-h-0 relative z-10"
                style={{ opacity: (timerState === 'PRIMING' && primingProgress < 1) ? 0.6 : 1 }}
            >
                {/* PINNED GOALS BANNER (Always Rendered & Interactive) */}
                {user && pinnedGoals.length > 0 && (
                    <div className="mb-7 w-full max-w-lg px-2 opacity-65 hover:opacity-100 transition-opacity animate-in fade-in duration-200 overflow-visible">
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

                {/* Scramble Display */}
                {isNoScramble ? (
                    <div className="mb-8 min-h-[4rem]" />
                ) : settings.hideScramble ? (
                    <div className="mb-8 min-h-[4rem] flex items-center justify-center">
                        <button
                            onClick={() => updateSettings({ hideScramble: false })}
                            className="font-mono text-text-secondary/50 italic hover:text-text-primary transition-colors cursor-pointer"
                        >
                            Scramble hidden
                        </button>
                    </div>
                ) : (
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
                                fontSize: `${(settings.scrambleSize || 1.8) * getScrambleSizeMultiplier()}rem`,
                                color: isCopied ? '#22c55e' : undefined
                            }}
                            title="Click to copy"
                        >
                            {scramble}
                        </p>
                    </div>
                )}

                {/* BIG TIMER DISPLAY */}
                <div className="text-center">
                    {timerState === 'INSPECTION' ? (
                        <h1
                            className={`font-normal font-mono ${getInspectionColor()}`}
                            style={{ fontSize: `${settings.timerSize || 8}rem`, lineHeight: 1 }}
                        >
                            {Math.abs(inspectionTime)}
                        </h1>
                    ) : timerState === 'RUNNING' ? (
                        settings.showLiveTimer ? (
                            <h1
                                className="font-normal font-mono text-text-primary"
                                style={{ fontSize: `${settings.timerSize || 8}rem`, lineHeight: 1 }}
                            >
                                {formatRunningTime(time)}
                            </h1>
                        ) : (
                            <h1
                                className="font-normal font-mono text-text-primary tracking-widest"
                                style={{ fontSize: `${settings.timerSize || 8}rem`, lineHeight: 1 }}
                            >
                                SOLVE
                            </h1>
                        )
                    ) : timerState === 'PRIMING' ? (
                        primingProgress >= 1 ? (
                            <h1
                                className="font-normal font-mono text-green-500"
                                style={{ fontSize: `${settings.timerSize || 8}rem`, lineHeight: 1 }}
                            >
                                Ready
                            </h1>
                        ) : (
                            prevTimerState === 'INSPECTION' ? (
                                <h1
                                    className={`font-normal font-mono ${getInspectionColor()}`}
                                    style={{ fontSize: `${settings.timerSize || 8}rem`, lineHeight: 1 }}
                                >
                                    {Math.abs(inspectionTime)}
                                </h1>
                            ) : (
                                <h1
                                    className={`font-normal font-mono text-text-primary ${primingProgress < 1 ? 'opacity-50' : ''}`}
                                    style={{ fontSize: `${settings.timerSize || 8}rem`, lineHeight: 1 }}
                                >
                                    {formatTime(time)}
                                </h1>
                            )
                        )
                    ) : (
                        <h1
                            className="font-normal font-mono text-text-primary"
                            style={{ fontSize: `${settings.timerSize || 8}rem`, lineHeight: 1 }}
                        >
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

            {/* LIVE BAR (Bottom) */}
            {isLiveMode && hasBottomUsers && (
                <div
                    className={`flex-shrink-0 w-full pb-2 pt-1 px-2.5 z-10 flex flex-col items-center justify-end transition-all ${isBottomDragOver ? 'bg-accent/10 rounded-xl border-2 border-dashed border-accent/40' : ''}`}
                    onDragOver={(e) => {
                        if (followerDisplay === 'popular') {
                            e.preventDefault();
                            setIsBottomDragOver(true);
                        }
                    }}
                    onDragLeave={() => setIsBottomDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsBottomDragOver(false);
                        const uid = e.dataTransfer.getData('text/plain');
                        if (uid) moveUserPosition(uid, 'bottom');
                    }}
                >
                    {/* Bottom Cards Row (in Popular mode) */}
                    {bottomCards.length > 0 && (
                        <div className="w-full flex items-center overflow-x-auto min-h-[128px] sm:min-h-[144px] py-4 px-4 no-scrollbar mask-fade-edges-cards mb-1">
                            <div className="flex items-center gap-3 min-w-max mx-auto px-4 justify-center">
                                {bottomCards.map(u => (
                                    <UserCard
                                        key={u.uid}
                                        user={u}
                                        onHide={() => hideUser(u.uid)}
                                        draggable={followerDisplay === 'popular'}
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', u.uid)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty Drop Zone for Popular Mode */}
                    {followerDisplay === 'popular' && bottomCards.length === 0 && bottomChips.length === 0 && (
                        <div className={`py-2 px-6 rounded-xl border border-dashed text-xs text-text-secondary/50 transition-colors my-1 select-none ${isBottomDragOver ? 'border-accent text-accent bg-accent/10' : 'border-border/30'}`}>
                            Drag cubers here to move to bottom
                        </div>
                    )}

                    {/* Subtle Search Input - only visible in default mode when overflowing or searching */}
                    {followerDisplay === 'default' && (isBottomOverflowing || searchQuery.length > 0) && (
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

                    {/* Popular & Minimal Mode: Bottom Followed Chips (Exact same behavior and styling as top chips) */}
                    {(followerDisplay === 'popular' || followerDisplay === 'minimal') && bottomChips.length > 0 && (
                        <div className="w-full flex items-center justify-center overflow-x-auto no-scrollbar py-1 px-4 mask-fade-edges">
                            <div className="flex items-center gap-2 flex-nowrap min-w-max mx-auto justify-center">
                                {bottomChips.map(u => (
                                    <button
                                        key={`hidden-bottom-${u.uid}`}
                                        type="button"
                                        draggable={followerDisplay === 'popular'}
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', u.uid)}
                                        onClick={() => unhideUser(u.uid)}
                                        className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 hover:border-accent/60 bg-bg-secondary/40 hover:bg-bg-secondary text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer group select-none shadow-2xs outline-none focus:outline-none"
                                        title={`Show ${u.username}'s card`}
                                    >
                                        <div className="w-3 h-3 relative flex items-center justify-center flex-shrink-0">
                                            <UserAvatar
                                                user={u}
                                                className="w-3 h-3 group-hover:scale-0 group-hover:opacity-0 transition-all duration-150"
                                                roundedClassName="rounded-sm"
                                            />
                                            <Maximize2 className="w-3 h-3 text-accent absolute inset-0 m-auto scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-150" />
                                        </div>
                                        <span className="font-medium truncate max-w-[110px]">{u.username}</span>
                                        {hasLinkedWca(u) && (
                                            <span
                                                title={`Verified WCA Competitor (${u.wcaId || 'Linked'})`}
                                                className="inline-flex items-center align-middle shrink-0"
                                            >
                                                <WcaBadge user={u} className="w-3 h-3 drop-shadow-2xs" />
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Default Mode: Community / Unfollowed Users */}
                    {followerDisplay === 'default' && bottomChips.length > 0 && (
                        <div
                            ref={bottomContainerRef}
                            className={`w-full overflow-hidden flex items-center min-h-[32px] ${isBottomOverflowing ? 'justify-start mask-fade-edges' : 'justify-center'}`}
                        >
                            {isBottomOverflowing ? (
                                <div className="animate-marquee-slow flex items-center gap-2 py-0.5 flex-nowrap pr-2">
                                    {[...bottomChips, ...bottomChips].map((u, idx) => (
                                        <button
                                            key={`comm-${u.uid}-${idx}`}
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleStarUser(u.uid);
                                            }}
                                            className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 hover:border-border bg-bg-secondary/30 hover:bg-bg-secondary text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer group select-none shadow-2xs outline-none focus:outline-none"
                                            title={`Follow ${u.username}`}
                                        >
                                            <UserAvatar
                                                user={u}
                                                className="w-2.5 h-2.5 flex-shrink-0 transition-transform group-hover:scale-110"
                                                roundedClassName="rounded-sm"
                                            />
                                            <span className="font-medium truncate max-w-[120px]">{u.username}</span>
                                            {hasLinkedWca(u) && (
                                                <span
                                                    title={`Verified WCA Competitor (${u.wcaId || 'Linked'})`}
                                                    className="inline-flex items-center align-middle shrink-0"
                                                >
                                                    <WcaBadge user={u} className="w-2.5 h-2.5 drop-shadow-2xs" />
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-nowrap justify-center items-center gap-2 py-0.5 max-w-full overflow-x-auto no-scrollbar">
                                    {bottomChips.map(u => (
                                        <button
                                            key={`comm-${u.uid}`}
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleStarUser(u.uid);
                                            }}
                                            className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 hover:border-border bg-bg-secondary/30 hover:bg-bg-secondary text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer group select-none shadow-2xs outline-none focus:outline-none"
                                            title={`Follow ${u.username}`}
                                        >
                                            <UserAvatar
                                                user={u}
                                                className="w-2.5 h-2.5 flex-shrink-0 transition-transform group-hover:scale-110"
                                                roundedClassName="rounded-sm"
                                            />
                                            <span className="font-medium truncate max-w-[120px]">{u.username}</span>
                                            {hasLinkedWca(u) && (
                                                <span
                                                    title={`Verified WCA Competitor (${u.wcaId || 'Linked'})`}
                                                    className="inline-flex items-center align-middle shrink-0"
                                                >
                                                    <WcaBadge user={u} className="w-2.5 h-2.5 drop-shadow-2xs" />
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* GUEST ACCOUNT 5-SOLVE NOTIFICATION */}
            {!user && showGuestPrompt && timerState !== 'RUNNING' && timerState !== 'PRIMING' && (
                <aside
                    aria-label="Account Reminder"
                    className="fixed bottom-14 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-40 max-w-md w-[calc(100%-2rem)] animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto select-none"
                >
                    <div className="bg-bg-secondary/95 backdrop-blur-md border border-accent/40 shadow-2xl rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="font-bold text-text-primary text-sm">Save Solves & Find Cubing Friends</h3>
                                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                                    Create a free account to automatically save your solves, unlock 50+ milestone goals, and find cubing friends.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowGuestPrompt(false)}
                                className="text-text-secondary/70 hover:text-text-primary p-1 rounded-md transition-colors shrink-0 cursor-pointer"
                                title="Dismiss"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                            <button
                                onClick={() => {
                                    setShowGuestPrompt(false);
                                    navigate('/account', { state: { mode: 'signin' } });
                                }}
                                className="px-3.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors cursor-pointer"
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => {
                                    setShowGuestPrompt(false);
                                    navigate('/account', { state: { mode: 'signup' } });
                                }}
                                className="px-4 py-1.5 text-xs font-bold bg-accent text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
                            >
                                Create Free Account
                            </button>
                        </div>
                    </div>
                </aside>
            )}

            {/* KEYBIND & POWER-USER FEATURE TOOLTIPS */}
            <KeybindTooltip timerState={timerState} totalSolves={solves.length} />
        </div>
    );
}

export default function Cube() {
    const isMobile = useIsMobile();
    return isMobile ? <MobileCube /> : <DesktopCube />;
}
