export type GoalCategory = 'time' | 'count' | 'streak' | 'diversity';

export interface GoalDefinition {
    id: string;
    category: GoalCategory;
    title: string;
    description: string;
    targetValue: number;
    unit?: string;
    formatValue?: (value: number) => string;
}

export interface GoalProgress {
    goalId: string;
    category: GoalCategory;
    title: string;
    description: string;
    currentValue: number;
    targetValue: number;
    completed: boolean;
    percentCompleted: number; // 0 to 100
    displayCurrent: string;
    displayTarget: string;
    streakStartDate?: string | null;
    streakEndDate?: string | null;
}

export interface UserGoalsDoc {
    completedGoalIds: string[];
    pinnedGoalIds: string[];
    totalCompleted: number;
    completionPercentage: number;
    categoryFilter?: GoalCategory | 'all';
    statusFilter?: 'all' | 'completed' | 'in-progress';
    updatedAt: string;
}

export interface GlobalGoalsStats {
    totalUsers: number;
    goalCompletionCounts: Record<string, number>;
    goalCompletionPercentages: Record<string, number>;
    totalGoalsCountDistribution: Record<number, number>;
    updatedAt?: string;
}

export interface UserStats {
    totalSolveTimeMs: number;
    totalSolvesCount: number;
    maxSolvesInSingleDay: number;
    dailySolvesCount: Record<string, number>;
    validSolvesPerEvent: Record<string, number>;
    hasAo5PerEvent: Record<string, boolean>;
    hasAo12PerEvent: Record<string, boolean>;
    hasAo100PerEvent: Record<string, boolean>;
    anyAo100Completed: boolean;
    bestAverages: Record<string, { single: number | null, ao5: number | null, ao12: number | null, ao100: number | null }>;
}
