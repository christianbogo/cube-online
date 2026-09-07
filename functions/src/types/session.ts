export interface SessionContextType {
    currentSessionId: string | null;
    startNewSession: (resume?: boolean) => Promise<string>;
    updateSessionActivity: (incrementCount?: boolean, overrideSessionId?: string) => void;
    checkSessionStatus: (lastSolveTime: number) => { isNewSessionNeeded: boolean };
    setCurrentSessionId: (id: string | null) => void;
    viewedSessionId: string | null;
    setViewedSessionId: (id: string | null) => void;
}
