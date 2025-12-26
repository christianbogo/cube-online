import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { doc, collection, addDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';



interface SessionContextType {
    currentSessionId: string | null;
    startNewSession: (resume?: boolean) => Promise<string>;
    updateSessionActivity: (incrementCount?: boolean) => void;
    checkSessionStatus: (lastSolveTime: number) => { isNewSessionNeeded: boolean };
    isSessionPromptVisible: boolean;
    setSessionPromptVisible: (visible: boolean) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
        return localStorage.getItem('cutter_current_session_id');
    });
    const [isSessionPromptVisible, setSessionPromptVisible] = useState(false);

    useEffect(() => {
        if (currentSessionId) {
            localStorage.setItem('cutter_current_session_id', currentSessionId);
        }
    }, [currentSessionId]);

    const startNewSession = async (resume = false) => {
        if (!user) return '';

        // If resume is true, we might just want to keep the current one or find the last one.
        // For now, "Resume" logic implies we just don't create a new one if we are prompted.
        // But if we are starting a FRESH session:
        if (!resume) {
            try {
                const docRef = await addDoc(collection(db, 'sessions'), {
                    userId: user.uid,
                    startedAt: new Date().toISOString(),
                    lastActiveAt: new Date().toISOString(),
                    solveCount: 0
                });
                setCurrentSessionId(docRef.id);
                return docRef.id;
            } catch (e) {
                console.error("Error creating session", e);
                // Fallback local ID?
                const localId = `local_${Date.now()}`;
                setCurrentSessionId(localId);
                return localId;
            }
        } else {
            // Resume means we just keep using the old ID, effectively doing nothing but closing prompt
            return currentSessionId || '';
        }
    };

    const updateSessionActivity = async (incrementCount: boolean = false) => {
        if (currentSessionId && !currentSessionId.startsWith('local_') && user) {
            try {
                // Update firestore
                const sessionRef = doc(db, 'sessions', currentSessionId);

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

        // New Day Check
        const lastDate = new Date(lastSolveTime);
        const currentDate = new Date(now);
        const isDifferentDay = lastDate.getDate() !== currentDate.getDate() ||
            lastDate.getMonth() !== currentDate.getMonth() ||
            lastDate.getFullYear() !== currentDate.getFullYear();

        if (diffMinutes > 60 || isDifferentDay) {
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
            isSessionPromptVisible,
            setSessionPromptVisible
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
