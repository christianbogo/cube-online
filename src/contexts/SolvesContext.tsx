import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { calculateAverage, calculateBestAverage } from '../utils/calculations';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Solve, Stats, SyncStatus } from '../types';

export type { Solve, Stats, SyncStatus };

interface SolvesContextType {
    solves: Solve[];
    stats: Stats;
    addSolve: (solve: Solve) => Promise<void>;
    updateSolve: (id: string, updates: Partial<Solve>) => void;
    deleteSolve: (id: string) => void;
    clearSolves: (keepBest: boolean) => void;
    trimSolves: (limit: number) => void;
    currentScramble: string | null;
    setCurrentScramble: (scramble: string) => void;
    syncStatus: SyncStatus;
    isPrivateMode: boolean;
    togglePrivateMode: () => void;
}

const SolvesContext = createContext<SolvesContextType | undefined>(undefined);

export function SolvesProvider({ children }: { children: ReactNode }) {
    // const { settings } = useSettings(); // Unused
    const { user } = useAuth();
    const { currentSessionId, checkSessionStatus, updateSessionActivity, setCurrentSessionId, startNewSession } = useSession();

    // Private Mode Persistence
    const [isPrivateMode, setIsPrivateMode] = useState(() => {
        return localStorage.getItem('cutter-cubing-private-mode') === 'true';
    });

    const [privateSolves, setPrivateSolves] = useState<Solve[]>(() => {
        const stored = localStorage.getItem('cutter-cubing-private-solves');
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem('cutter-cubing-private-mode', String(isPrivateMode));
    }, [isPrivateMode]);

    useEffect(() => {
        localStorage.setItem('cutter-cubing-private-solves', JSON.stringify(privateSolves));
    }, [privateSolves]);

    const togglePrivateMode = () => {
        setIsPrivateMode(prev => {
            const next = !prev;
            if (!next) {
                // Exiting Private Mode -> Wipe private solves
                setPrivateSolves([]);
                localStorage.removeItem('cutter-cubing-private-solves');
            }
            return next;
        });
    };

    const [solves, setSolves] = useState<Solve[]>(() => {
        const stored = localStorage.getItem('cutter-cubing-solves');
        return stored ? JSON.parse(stored) : [];
    });

    const prevUserRef = useRef<{ uid: string } | null | undefined>(undefined);

    // Wipe local solves on auth state change (Sign In / Sign Out)
    useEffect(() => {
        const isFirstRun = prevUserRef.current === undefined;
        const prevUser = prevUserRef.current;
        const currentUser = user;

        if (!isFirstRun) {
            const prevUid = prevUser?.uid;
            const currentUid = currentUser?.uid;

            if (prevUid !== currentUid) {
                // Auth change detected
                setSolves([]);
                localStorage.removeItem('cutter-cubing-solves');
            }
        }

        prevUserRef.current = user;
    }, [user]);

    // Check for session gap on initial load or focused // (Only for main solves)
    // REMOVED popups as requested
    /*
    useEffect(() => {
        if (!isPrivateMode && solves.length > 0) {
           ...
        }
    }, [isPrivateMode]);
    */

    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

    useEffect(() => {
        localStorage.setItem('cutter-cubing-solves', JSON.stringify(solves));
    }, [solves]);

    // Cloud Sync Logic
    useEffect(() => {
        if (!user || isPrivateMode) {
            setSyncStatus('idle');
            return;
        }

        // Listen for remote changes
        const q = query(collection(db, 'solves'), where('userId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data();
                    const remoteSolve: Solve = {
                        id: change.doc.id,
                        time: data.time,
                        scramble: data.scramble,
                        date: data.date,
                        penalty: data.penalty,
                        inspectionTime: data.inspectionTime,
                        inspectionPenalty: data.inspectionPenalty,
                        sessionId: data.sessionId,
                        userId: data.userId,
                        scrambleType: data.scrambleType || '333',
                        anomalyApproved: data.anomalyApproved
                    };

                    setSolves(prev => {
                        const exists = prev.find(s => s.id === remoteSolve.id);
                        if (exists) {
                            return prev.map(s => s.id === remoteSolve.id ? remoteSolve : s);
                        } else {
                            // Insert maintaining sort order (descending date)
                            const newSolves = [remoteSolve, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                            return newSolves;
                        }
                    });
                } else if (change.type === 'removed') {
                    setSolves(prev => prev.filter(s => s.id !== change.doc.id));
                }
            });
        }, (error) => {
            console.log("Snapshot error (likely permission/sign-out):", error.message);
        });

        return () => unsubscribe();
    }, [user, isPrivateMode]);

    const syncToCloud = async (solve: Solve, action: 'add' | 'update' | 'delete') => {
        if (!user || isPrivateMode) return;
        if (action === 'add') {
            console.log('Uploading Solve:', solve);
        }
        setSyncStatus('syncing');

        try {
            if (action === 'delete') {
                await deleteDoc(doc(db, 'solves', solve.id));
            } else {
                // Sanitize undefined values
                const dataToSave = JSON.parse(JSON.stringify({
                    ...solve,
                    userId: user.uid,
                    updatedAt: serverTimestamp()
                }));
                await setDoc(doc(db, 'solves', solve.id), dataToSave, { merge: true });
            }
            setSyncStatus('synced');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            console.error("Sync error", e);
            setSyncStatus('error');
        }
    };

    // Statistics Calculation
    const activeSolves = isPrivateMode ? privateSolves : solves; // Switch data source based on mode

    const stats: Stats = useMemo(() => {
        if (activeSolves.length === 0) {
            return {
                current: { single: null, ao5: null, ao12: null, ao100: null },
                best: { single: null, ao5: null, ao12: null, ao100: null }
            };
        }

        const current = {
            single: calculateAverage(activeSolves, 1),
            ao5: calculateAverage(activeSolves, 5),
            ao12: calculateAverage(activeSolves, 12),
            ao100: calculateAverage(activeSolves, 100),
        };

        // For "Best" stats:
        // If Private Mode: Best stats should only look at this private session (same as current if session is fresh). 
        // Requirement: "only allowing the stats table to look at the solves in this new private session and not be able to compare this numbers to the accounts best."
        // So for Private Mode, 'best' is effectively session best of current private session.
        // For Normal Mode: Best stats check cloud/official solves if signed in, or just local.

        let bestSolves = activeSolves;
        if (!isPrivateMode) {
            // If signed in, we might want to filter by user. But activeSolves is already solves.
            // If solves contains local items before sign in, they get wiped on sign in.
            // If solves contains cloud items, they have userId.
            // If we are signed OUT, solves contains local items (userId undefined).
            // So we should filter by userId ONLY if we are looking for "Account Best".
            // But for "Local Best" (signed out), we just use all activeSolves.

            if (user) {
                bestSolves = solves.filter(s => s.userId === user.uid);
            } else {
                // Signed out / Local
                bestSolves = solves;
            }
        }

        const getBestAverage = (size: number) => {
            return calculateBestAverage(bestSolves, size);
        };

        const validSingles = bestSolves
            .map(s => {
                if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return Infinity;
                let t = s.time;
                if (s.penalty === '+2') t += 2000;
                if (s.inspectionPenalty === '+2') t += 2000;
                return t;
            })
            .filter(t => t !== Infinity);

        const bestSingle = validSingles.length > 0 ? Math.min(...validSingles) : null;

        return {
            current,
            best: {
                single: bestSingle,
                ao5: getBestAverage(5),
                ao12: getBestAverage(12),
                ao100: getBestAverage(100),
            }
        };
    }, [activeSolves, solves, user, isPrivateMode]);

    const trimSolves = (limit: number) => {
        // Only trim main solves for now, or both? 
        // Private solves are ephemeral/session based usually? 
        // But "locally saved solves should be in their own local session" implies persistence?
        // Actually usually private/incognito implies NO persistence. 
        // But "saved should be in their own local session" might mean temporary persistence.
        // Let's assume trimming applies to whatever is active if we wanted, but the limit is global setting.
        // For safe side, only trim main list.
        if (!isPrivateMode) {
            setSolves(prev => {
                if (prev.length > limit) {
                    return prev.slice(0, limit);
                }
                return prev;
            });
        }
    };

    const addSolve = async (solve: Solve) => {
        let activeSessionId = currentSessionId;
        // In Private Mode, we should effectively have a 'private_session' ID or similar.
        // Requirements: "solves saved should be in their own local session... removed from right bar"
        // Let's just generate a 'private_session_[timestamp]' on mode entry? 
        // Or just let them pile up in `privateSolves` with a generic ID?
        // Since we switch `activeSolves` source, simple array append works.
        // We can assign a fake sessionId for stats calculation consistency.

        if (isPrivateMode) {
            const privateSolve = { ...solve, sessionId: 'private_session' };
            setPrivateSolves(prev => [privateSolve, ...prev]);
            return;
        }

        // Check for session break requirement (Main Mode)
        const targetScrambleType = solve.scrambleType || '333';
        const eventSolves = solves.filter(s =>
            (!user || s.userId === user.uid) &&
            (s.scrambleType || '333') === targetScrambleType
        );

        if (eventSolves.length > 0) {
            const lastSolve = eventSolves[0];
            const { isNewSessionNeeded } = checkSessionStatus(new Date(lastSolve.date).getTime());
            if (isNewSessionNeeded) {
                console.log("Auto-starting new session due to gap/stats.");
                await startNewSession(false);
                activeSessionId = null; // Force lazy creation below
            }
        }

        // Lazy Session Creation (Main Mode)
        if (!activeSessionId) {
            // Logic for both Auth and Anon
            // If Auth: create firestore doc
            // If Anon: create local session ID?
            // "When not signed into an account... stats table is not updating." 
            // Stats table relies on 'currentSessionId'.
            // If we don't have one, session stats are empty. 
            // We need a local session concept.

            if (user) {
                try {
                    const docRef = await addDoc(collection(db, 'sessions'), {
                        userId: user.uid,
                        startedAt: new Date().toISOString(),
                        lastActiveAt: new Date().toISOString(),
                        solveCount: 0
                    });
                    activeSessionId = docRef.id;
                    setCurrentSessionId(activeSessionId);
                } catch (e) {
                    console.error("Error creating lazy session", e);
                    activeSessionId = `local_${Date.now()}`;
                    setCurrentSessionId(activeSessionId);
                }
            } else {
                // Anon user
                activeSessionId = `local_${Date.now()}`;
                setCurrentSessionId(activeSessionId);
            }
        }

        const solveWithSession = {
            ...solve,
            userId: user?.uid,
            sessionId: activeSessionId || undefined
        };

        // Increment Session Count (Main Mode)
        if (activeSessionId && user) {
            updateSessionActivity(true, activeSessionId);
        }

        setSolves(prev => {
            const newSolves = [solveWithSession, ...prev];
            return newSolves;
        });

        // Sync to cloud
        await syncToCloud(solveWithSession, 'add');
    };

    const updateSolve = async (id: string, updates: Partial<Solve>) => {
        if (isPrivateMode) {
            setPrivateSolves(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
            return;
        }
        setSolves(prev => prev.map(s => {
            if (s.id === id) {
                const updated = { ...s, ...updates };
                syncToCloud(updated, 'update'); // Fire and forget
                return updated;
            }
            return s;
        }));
    };

    const deleteSolve = async (id: string) => {
        if (isPrivateMode) {
            setPrivateSolves(prev => prev.filter(s => s.id !== id));
            return;
        }
        const solve = solves.find(s => s.id === id);
        setSolves(prev => prev.filter(s => s.id !== id));
        if (solve) {
            await syncToCloud(solve, 'delete');
        }
    };

    const clearSolves = (keepBest: boolean) => {
        if (isPrivateMode) {
            setPrivateSolves([]);
            return;
        }
        if (!keepBest) {
            setSolves([]);
            return;
        }
        // ...
    };

    const [currentScramble, setCurrentScrambleState] = useState<string | null>(() => {
        return localStorage.getItem('cutter-cubing-current-scramble');
    });

    const setCurrentScramble = useCallback((scramble: string) => {
        setCurrentScrambleState(scramble);
        localStorage.setItem('cutter-cubing-current-scramble', scramble);
    }, []);

    return (
        <SolvesContext.Provider value={{ solves: activeSolves, stats, currentScramble, setCurrentScramble, addSolve, updateSolve, deleteSolve, clearSolves, trimSolves, syncStatus, isPrivateMode, togglePrivateMode }}>
            {children}
        </SolvesContext.Provider>
    );
}

export function useSolves() {
    const context = useContext(SolvesContext);
    if (context === undefined) {
        throw new Error('useSolves must be used within a SolvesProvider');
    }
    return context;
}


