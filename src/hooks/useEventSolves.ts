import { useState } from 'react';
import { type Solve } from '../contexts/SolvesContext';

/**
 * @deprecated Solve retrieval has been replaced with server-side pagination (getPaginatedSolves)
 * and server-side aggregation (getLogsSidebarData, getLogsBottomStats) to avoid loading bulk solves in memory.
 */
export function useEventSolves(_scrambleType: string) {
    const [solves] = useState<Solve[]>([]);
    const [loading] = useState<boolean>(false);

    const removeSolve = (_id: string) => {};
    const updateSolve = (_id: string, _updates: Partial<Solve>) => {};

    return { solves, loading, removeSolve, updateSolve };
}

