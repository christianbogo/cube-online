import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { rtdb } from '../lib/firebase';
import { ref, onDisconnect, set, onValue, remove } from 'firebase/database';
import { useAuth } from './AuthContext';
import { useSolves } from './SolvesContext';
import type { LiveUser, SimpleSolve, TimerState } from '../types';

interface LiveContextType {
    isGhostMode: boolean;
    setIsGhostMode: (val: boolean | ((prev: boolean) => boolean)) => void;
    toggleGhostMode: () => void;
    isLiveMode: boolean;
    setIsLiveMode: (val: boolean | ((prev: boolean) => boolean)) => void;
    connectedUsers: LiveUser[];
    liveTimerState: TimerState;
    setLiveTimerState: (state: TimerState) => void;
}

const LiveContext = createContext<LiveContextType | undefined>(undefined);

const TEN_MINUTES_MS = 10 * 60 * 1000;

export function LiveProvider({ children }: { children: ReactNode }) {
    const { user, updateGhostMode } = useAuth();
    const { solves } = useSolves();

    const [isGhostMode, setIsGhostModeState] = useState<boolean>(() => {
        if (user && typeof user.isGhostMode === 'boolean') {
            return user.isGhostMode;
        }
        return localStorage.getItem('cube-online-ghost-mode') === 'true';
    });

    const isLiveMode = !isGhostMode;

    const [connectedUsers, setConnectedUsers] = useState<LiveUser[]>([]);
    const [liveTimerState, setLiveTimerState] = useState<TimerState>('IDLE');

    // Last solve timestamp tracking
    const lastSolveTimestampRef = useRef<number>(Date.now());
    const prevFirstSolveIdRef = useRef<string | null>(null);

    // Sync with user profile isGhostMode when user data loads/changes
    useEffect(() => {
        if (user && typeof user.isGhostMode === 'boolean') {
            setIsGhostModeState(user.isGhostMode);
            localStorage.setItem('cube-online-ghost-mode', String(user.isGhostMode));
        }
    }, [user?.isGhostMode]);

    const setIsGhostMode = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
        setIsGhostModeState(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            localStorage.setItem('cube-online-ghost-mode', String(next));
            if (user) {
                updateGhostMode(next);
            }
            if (!next) {
                lastSolveTimestampRef.current = Date.now();
            }
            return next;
        });
    }, [user, updateGhostMode]);

    const toggleGhostMode = useCallback(() => {
        setIsGhostMode(prev => !prev);
    }, [setIsGhostMode]);

    const setIsLiveMode = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
        setIsGhostMode(prev => {
            const nextLive = typeof val === 'function' ? val(!prev) : val;
            return !nextLive;
        });
    }, [setIsGhostMode]);

    // Track solve additions to update lastSolveTimestampRef
    useEffect(() => {
        if (solves.length > 0) {
            const firstSolve = solves[0];
            if (firstSolve.id !== prevFirstSolveIdRef.current) {
                prevFirstSolveIdRef.current = firstSolve.id;
                lastSolveTimestampRef.current = Date.now();
            }
        }
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

    const lastUidRef = useRef<string | null>(null);
    const onDisconnectSetRef = useRef<string | null>(null);

    // Firebase Presence Sync
    useEffect(() => {
        if (!user || isGhostMode) {
            if (lastUidRef.current) {
                const userPresenceRef = ref(rtdb, `presence/${lastUidRef.current}`);
                remove(userPresenceRef).catch(() => {});
                lastUidRef.current = null;
                onDisconnectSetRef.current = null;
            }
            return;
        }

        lastUidRef.current = user.uid;
        const userPresenceRef = ref(rtdb, `presence/${user.uid}`);
        const currentRecent = formatRecentSolves();

        const updatePresence = () => {
            const data: LiveUser = {
                uid: user.uid,
                username: user.username || 'CubingUser',
                color: user.color || '#ef4444',
                status: liveTimerState,
                lastSolveTime: (solves.length > 0 && typeof solves[0]?.time === 'number') ? solves[0].time : null,
                recentSolves: currentRecent,
                timestamp: Date.now()
            };
            set(userPresenceRef, data);
        };

        updatePresence();

        if (onDisconnectSetRef.current !== user.uid) {
            onDisconnect(userPresenceRef).remove();
            onDisconnectSetRef.current = user.uid;
        }

        // Heartbeat interval every 30s to keep timestamp fresh while active/in other tabs
        const heartbeatInterval = setInterval(() => {
            updatePresence();
        }, 30000);

        return () => {
            clearInterval(heartbeatInterval);
        };
    }, [user, isGhostMode, liveTimerState, solves, formatRecentSolves]);

    // Listen for other live users
    useEffect(() => {
        if (isGhostMode) {
            setConnectedUsers([]);
            return;
        }

        const presenceRef = ref(rtdb, 'presence');
        const unsubscribe = onValue(presenceRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const now = Date.now();
                const users: LiveUser[] = Object.values(data);
                // Filter out current user and any users inactive for > 10 mins
                const others = users.filter(u => u.uid !== user?.uid && (now - (u.timestamp || 0)) <= TEN_MINUTES_MS);
                setConnectedUsers(others);
            } else {
                setConnectedUsers([]);
            }
        });

        return () => unsubscribe();
    }, [user?.uid, isGhostMode]);

    return (
        <LiveContext.Provider value={{
            isGhostMode,
            setIsGhostMode,
            toggleGhostMode,
            isLiveMode,
            setIsLiveMode,
            connectedUsers,
            liveTimerState,
            setLiveTimerState
        }}>
            {children}
        </LiveContext.Provider>
    );
}

export function useLive() {
    const context = useContext(LiveContext);
    if (context === undefined) {
        throw new Error('useLive must be used within a LiveProvider');
    }
    return context;
}
