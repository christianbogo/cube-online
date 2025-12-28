export type TimerState = 'IDLE' | 'INSPECTION' | 'PRIMING' | 'RUNNING' | 'SOLVED';

export interface SimpleSolve {
    time: number;
    penalty: 'none' | '+2' | 'DNF';
    inspectionPenalty?: 'none' | '+2' | 'DNF';
    daily: string | null;
    timestamp: number;
}

export interface LiveUser {
    uid: string;
    username: string;
    color: string;
    status: TimerState;
    lastSolveTime?: number;
    recentSolves?: SimpleSolve[];
    timestamp: number;
}
