import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { rtdb } from '../lib/firebase';
import { ref, onDisconnect, set, onValue, remove } from 'firebase/database';
import { useAuth } from './AuthContext';
import { useSolves } from './SolvesContext';
import type { LiveUser, SimpleSolve, TimerState } from '../types';

interface LiveContextType {
    isLiveMode: boolean;
    setIsLiveMode: (val: boolean | ((prev: boolean) => boolean)) => void;
    connectedUsers: LiveUser[];
    liveTimerState: TimerState;
    setLiveTimerState: (state: TimerState) => void;
}

const LiveContext = createContext<LiveContextType | undefined>(undefined);

const TEN_MINUTES_MS = 10 * 60 * 1000;

export function LiveProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { solves } = useSolves();

    const [isLiveMode, setIsLiveModeState] = useState<boolean>(() => {
        return localStorage.getItem('cube-online-live-mode') === 'true';
    });

    const [connectedUsers, setConnectedUsers] = useState<LiveUser[]>([]);
    const [liveTimerState, setLiveTimerState] = useState<TimerState>('IDLE');

    // Last solve timestamp tracking for the 10-minute inactivity timeout
    const lastSolveTimestampRef = useRef<number>(Date.now());
    const prevFirstSolveIdRef = useRef<string | null>(null);

    const setIsLiveMode = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
        setIsLiveModeState(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            localStorage.setItem('cube-online-live-mode', String(next));
            if (next) {
                // Reset inactivity timer when entering live mode
                lastSolveTimestampRef.current = Date.now();
            }
            return next;
        });
    }, []);

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

    // 10-Minute Solve Inactivity Timer:
    // Keeps user live when visiting other pages or switching browser tabs,
    // but automatically turns off live if 10 minutes pass without completing a solve.
    useEffect(() => {
        if (!isLiveMode) return;

        const interval = setInterval(() => {
            const elapsed = Date.now() - lastSolveTimestampRef.current;
            if (elapsed >= TEN_MINUTES_MS) {
                console.log('Auto-disabling Live Mode: 10 minutes elapsed without a solve.');
                setIsLiveMode(false);
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [isLiveMode, setIsLiveMode]);

    // Helper for live solves broadcast
    const formatRecentSolves = useCallback((): SimpleSolve[] => {
        return solves.slice(0, 4).map(s => ({
            time: s.time,
            penalty: s.penalty,
            inspectionPenalty: s.inspectionPenalty,
            timestamp: new Date(s.date).getTime()
        }));
    }, [solves]);

    // Firebase Presence Sync
    useEffect(() => {
        if (!user || !isLiveMode) {
            if (user) {
                const userPresenceRef = ref(rtdb, `presence/${user.uid}`);
                remove(userPresenceRef).catch(() => {});
            }
            return;
        }

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
        onDisconnect(userPresenceRef).remove();

        // Heartbeat interval every 30s to keep timestamp fresh while active/in other tabs
        const heartbeatInterval = setInterval(() => {
            updatePresence();
        }, 30000);

        return () => {
            clearInterval(heartbeatInterval);
            remove(userPresenceRef).catch(() => {});
        };
    }, [user, isLiveMode, liveTimerState, solves, formatRecentSolves]);

    // Listen for other live users
    useEffect(() => {
        if (!isLiveMode) {
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
    }, [user?.uid, isLiveMode]);

    return (
        <LiveContext.Provider value={{ isLiveMode, setIsLiveMode, connectedUsers, liveTimerState, setLiveTimerState }}>
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
