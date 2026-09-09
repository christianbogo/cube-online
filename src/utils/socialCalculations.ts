import type { UserData } from '../types';

export interface LeaderboardEntry {
    rank: number;
    user: UserData;
    scoreValue: number;
    scoreDisplay: string;
    secondaryDisplay?: string;
    isCurrentUser?: boolean;
}

export interface LeaderboardSlot {
    rank: number;
    entry: LeaderboardEntry | null;
    isEmpty: boolean;
    emptyText: string;
}
