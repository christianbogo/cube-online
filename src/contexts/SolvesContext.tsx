import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { useSettings } from './SettingsContext';
import { calculateAverage } from '../utils/calculations';

export interface Solve {
    id: string;
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

interface SolvesContextType {
    solves: Solve[];
    stats: Stats;
    addSolve: (solve: Solve) => void;
    updateSolve: (id: string, updates: Partial<Solve>) => void;
    deleteSolve: (id: string) => void;
    clearSolves: (keepBest: boolean) => void;
    currentScramble: string | null;
    setCurrentScramble: (scramble: string) => void;
}

const SolvesContext = createContext<SolvesContextType | undefined>(undefined);

export function SolvesProvider({ children }: { children: ReactNode }) {
    const { settings } = useSettings();
    const [solves, setSolves] = useState<Solve[]>(() => {
        const stored = localStorage.getItem('cutter-cubing-solves');
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem('cutter-cubing-solves', JSON.stringify(solves));
    }, [solves]);

    // Statistics Calculation
    const stats: Stats = useMemo(() => {
        if (solves.length === 0) {
            return {
                current: { single: null, ao5: null, ao12: null, ao100: null },
                best: { single: null, ao5: null, ao12: null, ao100: null }
            };
        }

        // Current Stats (Top of list)
        const current = {
            single: calculateAverage(solves, 1),
            ao5: calculateAverage(solves, 5),
            ao12: calculateAverage(solves, 12),
            ao100: calculateAverage(solves, 100),
        };

        // Best Stats (Scan all - potentially expensive for huge lists, optimization: only recalc on add/delete or memoize deeper)
        // For 'Best Single', we check all individual times.
        // For 'Best Average', we technically need to slide a window.
        // Given constraints (usually < few thousand local solves), sliding window is ok.

        const getBestAverage = (size: number) => {
            let best: number | null = null;
            // Iterate through all windows
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
            // Note: IF no numeric average found (all DNF windows?), return null or something?
            // If strictly all DNF, maybe 'DNF' is the best? Typically "Best" ignores pure DNF blocks unless that's all there is.
            // Let's assume numerical best for now.
        };

        // Best Single logic:
        // Filter valid times, find min.
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


    const addSolve = (solve: Solve) => {
        setSolves(prev => {
            const newSolves = [solve, ...prev];

            // Handle local data limits
            if (!settings.localDataSettings.saveAll) {
                const limit = settings.localDataSettings.saveLastX;
                if (newSolves.length > limit) {
                    return newSolves.slice(0, limit);
                }
            }
            return newSolves;
        });
    };

    const updateSolve = (id: string, updates: Partial<Solve>) => {
        setSolves(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const deleteSolve = (id: string) => {
        setSolves(prev => prev.filter(s => s.id !== id));
    };

    // Helper to find range of indices for best average
    // Used for "Clear Non-Essential"
    const getIndicesOfBestAverage = (size: number, currentSolves: Solve[]): number[] => {
        let best: number | null = null;
        let bestIndex = -1;

        for (let i = 0; i <= currentSolves.length - size; i++) {
            const window = currentSolves.slice(i, i + size);
            const avg = calculateAverage(window, size);
            if (typeof avg === 'number') {
                if (best === null || avg < best) {
                    best = avg;
                    bestIndex = i;
                }
            }
        }

        if (bestIndex !== -1) {
            // Return array of indices [bestIndex, bestIndex+1, ... bestIndex+size-1]
            return Array.from({ length: size }, (_, k) => k + bestIndex);
        }
        return [];
    };

    const clearSolves = (keepBest: boolean) => {
        if (!keepBest) {
            setSolves([]);
            return;
        }

        // Identify indices to keep
        const indicesToKeep = new Set<number>();

        // 1. Keep Best Single (Find index of min time)
        let bestSingleIndex = -1;
        let bestSingleTime = Infinity;
        solves.forEach((s, idx) => {
            if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') return;
            let t = s.time;
            if (s.penalty === '+2') t += 2000;
            if (s.inspectionPenalty === '+2') t += 2000;

            if (t < bestSingleTime) {
                bestSingleTime = t;
                bestSingleIndex = idx;
            }
        });
        if (bestSingleIndex !== -1) indicesToKeep.add(bestSingleIndex);

        // 2. Keep Best Ao5, Ao12, Ao100
        const bestAo5Indices = getIndicesOfBestAverage(5, solves);
        bestAo5Indices.forEach(i => indicesToKeep.add(i));

        const bestAo12Indices = getIndicesOfBestAverage(12, solves);
        bestAo12Indices.forEach(i => indicesToKeep.add(i));

        const bestAo100Indices = getIndicesOfBestAverage(100, solves);
        bestAo100Indices.forEach(i => indicesToKeep.add(i));

        // Filter
        setSolves(prev => prev.filter((_, index) => indicesToKeep.has(index)));
    };

    const [currentScramble, setCurrentScrambleState] = useState<string | null>(() => {
        return localStorage.getItem('cutter-cubing-current-scramble');
    });

    const setCurrentScramble = (scramble: string) => {
        setCurrentScrambleState(scramble);
        localStorage.setItem('cutter-cubing-current-scramble', scramble);
    };

    return (
        <SolvesContext.Provider value={{ solves, stats, currentScramble, setCurrentScramble, addSolve, updateSolve, deleteSolve, clearSolves }}>
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
