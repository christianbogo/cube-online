import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { useSettings } from './SettingsContext';
import { calculateAverage } from '../utils/calculations';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Solve {
    id: string;
    userId?: string;
    sessionId?: string;
    time: number; // in milliseconds
    scramble: string;
    date: string; // ISO string
    penalty: 'none' | '+2' | 'DNF';
    inspectionTime?: number;
    inspectionPenalty?: 'none' | '+2' | 'DNF';
}

interface Stats {
    current: {
        single: number | 'DNF' | null;
        ao5: number | 'DNF' | null;
        ao12: number | 'DNF' | null;
        ao100: number | 'DNF' | null;
    };
    best: {
        single: number | 'DNF' | null;
        ao5: number | 'DNF' | null;
        ao12: number | 'DNF' | null;
        ao100: number | 'DNF' | null;
    };
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

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
}

const SolvesContext = createContext<SolvesContextType | undefined>(undefined);

export function SolvesProvider({ children }: { children: ReactNode }) {
    const { settings } = useSettings();
    const { user } = useAuth();
    const { currentSessionId, checkSessionStatus, setSessionPromptVisible, updateSessionActivity, setCurrentSessionId } = useSession();

    const [solves, setSolves] = useState<Solve[]>(() => {
        const stored = localStorage.getItem('cutter-cubing-solves');
        return stored ? JSON.parse(stored) : [];
    });

    // Check for session gap on initial load or focused
    useEffect(() => {
        if (solves.length > 0) {
            const lastSolve = solves[0];
            const { isNewSessionNeeded } = checkSessionStatus(new Date(lastSolve.date).getTime());
            if (isNewSessionNeeded) {
                setSessionPromptVisible(true);
            }
        }
    }, []); // Only on mount

    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

    useEffect(() => {
        localStorage.setItem('cutter-cubing-solves', JSON.stringify(solves));
    }, [solves]);

    // Cloud Sync Logic
    useEffect(() => {
        if (!user) {
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
                        userId: data.userId
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
    }, [user]);

    const syncToCloud = async (solve: Solve, action: 'add' | 'update' | 'delete') => {
        if (!user) return;
        setSyncStatus('syncing');

        try {
            if (action === 'delete') {
                await deleteDoc(doc(db, 'solves', solve.id));
            } else {
                // If backup strategy is bests/last100, we might strictly only want to sync those.
                // But for now syncing all to Firestore is simpler, then we can filter in query or cloud functions if needed.
                // Given requirement: "Last 100 solves + Bests" for some modes.
                // Assuming efficient enough to just write all for now unless restricted.
                // If mode is 'local-only', do NOT write.
                // Syncing all solves by default now (unlimited sync)
                // if (settings.dataBackup === 'local-only') { setSyncStatus('idle'); return; }

                await setDoc(doc(db, 'solves', solve.id), {
                    ...solve,
                    userId: user.uid,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
            setSyncStatus('synced');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            console.error("Sync error", e);
            setSyncStatus('error');
        }
    };

    // Statistics Calculation (Unchanged)
    const stats: Stats = useMemo(() => {
        if (solves.length === 0) {
            return {
                current: { single: null, ao5: null, ao12: null, ao100: null },
                best: { single: null, ao5: null, ao12: null, ao100: null }
            };
        }

        const current = {
            single: calculateAverage(solves, 1),
            ao5: calculateAverage(solves, 5),
            ao12: calculateAverage(solves, 12),
            ao100: calculateAverage(solves, 100),
        };

        const getBestAverage = (size: number) => {
            let best: number | null = null;
            for (let i = 0; i <= solves.length - size; i++) {
                const window = solves.slice(i, i + size);
                const avg = calculateAverage(window, size);
                if (typeof avg === 'number') {
                    if (best === null || avg < best) {
                        best = avg;
                    }
                }
            }
            return best;
        };

        const validSingles = solves
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
    }, [solves]);

    const trimSolves = (limit: number) => {
        setSolves(prev => {
            if (prev.length > limit) {
                // TODO: If Cloud Sync is active, should we delete remote too if they are outside limit?
                // Requirements say: "always cloud sync the last 100 solves" for some modes.
                return prev.slice(0, limit);
            }
            return prev;
        });
    };

    const addSolve = async (solve: Solve) => {
        let activeSessionId = currentSessionId;

        // Lazy Session Creation: if no active session (and user logged in), create one now.
        if (!activeSessionId && user) {
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
        }

        const solveWithSession = {
            ...solve,
            userId: user?.uid,
            sessionId: activeSessionId || undefined
        };

        // Check for session gap
        if (solves.length > 0) {
            const { isNewSessionNeeded } = checkSessionStatus(new Date(solve.date).getTime());
            if (isNewSessionNeeded) {
                setSessionPromptVisible(true);
            }
        }

        // Increment Session Count if active
        // Only if we aren't creating a NEW session via the Prompt right away?
        // Actually, if we just added a solve, we technically extended the CURRENT session (even if old).
        // Unless user clicks "Start Fresh". But that happens async via Toast.
        // For now, increment current. If user starts fresh, this solve remains in old session (correct).
        // If user resumes, count is correct.
        if (activeSessionId && user) {
            updateSessionActivity(true, activeSessionId);
        }

        setSolves(prev => {
            const newSolves = [solveWithSession, ...prev];
            if (!settings.localDataSettings.saveAll) {
                const limit = settings.localDataSettings.localLimit || settings.localDataSettings.saveLastX;
                if (newSolves.length > limit) {
                    return newSolves.slice(0, limit);
                }
            }
            return newSolves;
        });

        // Sync to cloud
        await syncToCloud(solveWithSession, 'add');
    };

    const updateSolve = async (id: string, updates: Partial<Solve>) => {
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
        const solve = solves.find(s => s.id === id);
        setSolves(prev => prev.filter(s => s.id !== id));
        if (solve) {
            await syncToCloud(solve, 'delete');
        }
    };

    const clearSolves = (keepBest: boolean) => {
        if (!keepBest) {
            setSolves([]);
            // TODO: Delete all from cloud? Dangerous.
            return;
        }
        // ... (Keep best logic largely local handling for now unless we need bulk delete)
        // For simplicity, we just clear local view logic as before.
        // If we want to purge references, we'd need to batch delete.
    };

    const [currentScramble, setCurrentScrambleState] = useState<string | null>(() => {
        return localStorage.getItem('cutter-cubing-current-scramble');
    });

    const setCurrentScramble = (scramble: string) => {
        setCurrentScrambleState(scramble);
        localStorage.setItem('cutter-cubing-current-scramble', scramble);
    };

    return (
        <SolvesContext.Provider value={{ solves, stats, currentScramble, setCurrentScramble, addSolve, updateSolve, deleteSolve, clearSolves, trimSolves, syncStatus }}>
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


