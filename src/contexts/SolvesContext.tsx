import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSettings } from './SettingsContext';

export interface Solve {
    id: string;
    time: number; // in milliseconds
    scramble: string;
    date: string; // ISO string
    penalty: 'none' | '+2' | 'DNF';
}

interface SolvesContextType {
    solves: Solve[];
    addSolve: (solve: Solve) => void;
    updateSolve: (id: string, updates: Partial<Solve>) => void;
    deleteSolve: (id: string) => void;
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

    return (
        <SolvesContext.Provider value={{ solves, addSolve, updateSolve, deleteSolve }}>
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
