import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { doc, updateDoc, increment, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';



interface SessionContextType {
    currentSessionId: string | null;
    startNewSession: (resume?: boolean) => Promise<string>;
    updateSessionActivity: (incrementCount?: boolean, overrideSessionId?: string) => void;
    checkSessionStatus: (lastSolveTime: number) => { isNewSessionNeeded: boolean };
    setCurrentSessionId: (id: string | null) => void;
    viewedSessionId: string | null;
    setViewedSessionId: (id: string | null) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
        return localStorage.getItem('cutter_current_session_id');
    });
    const [viewedSessionId, setViewedSessionId] = useState<string | null>(null);

    useEffect(() => {
        if (currentSessionId) {
            localStorage.setItem('cutter_current_session_id', currentSessionId);
        }
    }, [currentSessionId]);

    const startNewSession = async (resume = false) => {
        if (!user) return '';

        if (!resume) {
            // Check if current session is empty (0 solves) and delete it if so
            if (currentSessionId && !currentSessionId.startsWith('local_')) {
                try {
                    const sessionDoc = await getDoc(doc(db, 'sessions', currentSessionId));
                    if (sessionDoc.exists()) {
                        if (sessionDoc.data().solveCount === 0) {
                            await deleteDoc(doc(db, 'sessions', currentSessionId));
                        }
                    }
                } catch (e) {
                    // Suppress permission errors or missing doc errors during cleanup
                    // We simply want to ensure we move on visually.
                    console.warn("Could not delete empty session (likely permission or already deleted):", e);
                }
            }

            // Don't create new one yet. Set to null.
            setCurrentSessionId(null);
            localStorage.removeItem('cutter_current_session_id');
            return '';
        } else {
            return currentSessionId || '';
        }
    };

    const updateSessionActivity = async (incrementCount: boolean = false, overrideSessionId?: string) => {
        const targetId = overrideSessionId || currentSessionId;
        if (targetId && !targetId.startsWith('local_') && user) {
            try {
                // Update firestore
                const sessionRef = doc(db, 'sessions', targetId);

                const updates: any = {
                    lastActiveAt: new Date().toISOString()
                };

                if (incrementCount) {
                    updates.solveCount = increment(1);
                }

                await updateDoc(sessionRef, updates);
            } catch (e) {
                console.error("Error updating session", e);
            }
        }
    };

    const checkSessionStatus = (lastSolveTime: number) => {
        const now = Date.now();
        const diffMinutes = (now - lastSolveTime) / (1000 * 60);

        // New Day Check - Removed strict enforcement
        // const lastDate = new Date(lastSolveTime);
        // const currentDate = new Date(now);
        // const isDifferentDay = ...

        if (diffMinutes > 60) {
            return { isNewSessionNeeded: true };
        }
        return { isNewSessionNeeded: false };
    };

    return (
        <SessionContext.Provider value={{
            currentSessionId,
            startNewSession,
            updateSessionActivity,
            checkSessionStatus,
            setCurrentSessionId, // Exposed for merge logic
            viewedSessionId,
            setViewedSessionId
        }}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
