export type FeedbackType = 'bug' | 'feature' | 'improvement' | 'other';
export type FeedbackStatus = 'open' | 'archived';

export interface DevFeedback {
    id: string;
    type: FeedbackType;
    title: string;
    description: string;
    userEmail?: string;
    userId?: string;
    username?: string;
    status: FeedbackStatus;
    createdAt: string; // ISO string
    archivedAt?: string | null; // ISO string
}

export type ChangelogCategory = 'release' | 'feature' | 'improvement' | 'fix';

export interface ChangelogEntry {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD or ISO string
    version?: string; // e.g. 'v0.4.0'
    category?: ChangelogCategory;
    items: string[];
    images?: string[]; // URLs or base64 data URLs
    createdAt: string;
    author?: string;
}

export interface FirebaseMetrics {
    totalSolves: number;
    totalSolvingTimeMs: number;
    activeUsersPastMonth: number;
    solvesToday: number;
    lastUpdated: string;
    loading: boolean;
    error: string | null;
}
