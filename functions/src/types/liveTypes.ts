export type TimerState = 'IDLE' | 'INSPECTION' | 'PRIMING' | 'RUNNING' | 'SOLVED';

export interface SimpleSolve {
    time: number;
    penalty: 'none' | '+2' | 'DNF';
    inspectionPenalty?: 'none' | '+2' | 'DNF';
    timestamp: number;
}

export interface LiveUser {
    uid: string;
    username: string;
    color: string;
    status: TimerState;
    lastSolveTime?: number | null;
    recentSolves?: SimpleSolve[];
    timestamp: number;
}
