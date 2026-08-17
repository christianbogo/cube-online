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
}

export interface UserGoalsDoc {
    completedGoalIds: string[];
    pinnedGoalIds: string[];
    totalCompleted: number;
    completionPercentage: number;
    updatedAt: string;
}

export interface GlobalGoalsStats {
    totalUsers: number;
    goalCompletionCounts: Record<string, number>;
    goalCompletionPercentages: Record<string, number>;
    totalGoalsCountDistribution: Record<number, number>;
    updatedAt?: string;
}
