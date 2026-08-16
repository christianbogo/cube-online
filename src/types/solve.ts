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
    scrambleType?: string; // e.g. '333', '444', 'clock'
    anomalyApproved?: boolean;
}

export interface StatsBreakdown {
    single: number | 'DNF' | null;
    ao5: number | 'DNF' | null;
    ao12: number | 'DNF' | null;
    ao100: number | 'DNF' | null;
}

export interface Stats {
    current: StatsBreakdown;
    best: StatsBreakdown;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
