import type { Solve } from '../types/solve';
import type { GoalDefinition, GoalProgress, GoalCategory } from '../types/goals';
import { calculateBestAverage } from './calculations';
import { SUPPORTED_EVENT_IDS, AVERAGEABLE_EVENT_IDS } from './constants';
import { format } from 'date-fns';

export const GOAL_DEFINITIONS: GoalDefinition[] = [
    // Category 1: Time Spent Solving
    {
        id: 'time-create-account',
        category: 'time',
        title: 'Join the Community',
        description: 'Create and sign in to a Cube Online account.',
        targetValue: 1,
        unit: 'account'
    },
    {
        id: 'time-warm-hands',
        category: 'time',
        title: 'Warm Hands',
        description: 'Accumulate 15 minutes of total solve time.',
        targetValue: 15 * 60 * 1000,
        unit: 'time'
    },
    {
        id: 'time-first-session',
        category: 'time',
        title: 'First Session Down',
        description: 'Accumulate 1 hour of solve time.',
        targetValue: 60 * 60 * 1000,
        unit: 'time'
    },
    {
        id: 'time-deep-focus',
        category: 'time',
        title: 'Deep Focus',
        description: 'Accumulate 5 hours of solve time.',
        targetValue: 5 * 60 * 60 * 1000,
        unit: 'time'
    },
    {
        id: 'time-double-digits',
        category: 'time',
        title: 'Double Digits',
        description: 'Accumulate 10 hours of solve time.',
        targetValue: 10 * 60 * 60 * 1000,
        unit: 'time'
    },
    {
        id: 'time-full-rotation',
        category: 'time',
        title: 'Full Rotation',
        description: 'Accumulate 24 total hours of active solving.',
        targetValue: 24 * 60 * 60 * 1000,
        unit: 'time'
    },
    {
        id: 'time-weekend-warrior',
        category: 'time',
        title: 'Weekend Warrior',
        description: 'Accumulate 48 hours of solve time.',
        targetValue: 48 * 60 * 60 * 1000,
        unit: 'time'
    },
    {
        id: 'time-centurion',
        category: 'time',
        title: 'Centurion',
        description: 'Accumulate 100 hours of solve time.',
        targetValue: 100 * 60 * 60 * 1000,
        unit: 'time'
    },
    {
        id: 'time-quarter-k',
        category: 'time',
        title: 'Quarter-K',
        description: 'Accumulate 250 hours of solve time.',
        targetValue: 250 * 60 * 60 * 1000,
        unit: 'time'
    },
    {
        id: 'time-halftime',
        category: 'time',
        title: 'Halftime',
        description: 'Accumulate 500 hours of solve time.',
        targetValue: 500 * 60 * 60 * 1000,
        unit: 'time'
    },
    {
        id: 'time-1000-hours',
        category: 'time',
        title: 'The 1,000-Hour Rule',
        description: 'Accumulate 1,000 hours of active solving.',
        targetValue: 1000 * 60 * 60 * 1000,
        unit: 'time'
    },
    {
        id: 'time-master',
        category: 'time',
        title: 'Master of Time',
        description: 'Accumulate 2,500 hours of active solving.',
        targetValue: 2500 * 60 * 60 * 1000,
        unit: 'time'
    },

    // Category 2: Solve Count Milestones
    {
        id: 'count-first-turn',
        category: 'count',
        title: 'First Turn',
        description: 'Complete 1 solve.',
        targetValue: 1,
        unit: 'solves'
    },
    {
        id: 'count-quick-ten',
        category: 'count',
        title: 'Quick Ten',
        description: 'Complete 10 solves.',
        targetValue: 10,
        unit: 'solves'
    },
    {
        id: 'count-warmup',
        category: 'count',
        title: 'The Warmup',
        description: 'Complete 50 solves.',
        targetValue: 50,
        unit: 'solves'
    },
    {
        id: 'count-century-club',
        category: 'count',
        title: 'Century Club',
        description: 'Complete 100 solves.',
        targetValue: 100,
        unit: 'solves'
    },
    {
        id: 'count-ao100-unlocked',
        category: 'count',
        title: 'Ao100 Unlocked',
        description: 'Complete your first full Average of 100.',
        targetValue: 1,
        unit: 'average'
    },
    {
        id: 'count-getting-serious',
        category: 'count',
        title: 'Getting Serious',
        description: 'Complete 250 solves.',
        targetValue: 250,
        unit: 'solves'
    },
    {
        id: 'count-half-a-grand',
        category: 'count',
        title: 'Half a Grand',
        description: 'Complete 500 solves.',
        targetValue: 500,
        unit: 'solves'
    },
    {
        id: 'count-millennium',
        category: 'count',
        title: 'Millennium Solver',
        description: 'Complete 1,000 solves.',
        targetValue: 1000,
        unit: 'solves'
    },
    {
        id: 'count-five-digit',
        category: 'count',
        title: 'Five-Digit Grinder',
        description: 'Complete 2,500 solves.',
        targetValue: 2500,
        unit: 'solves'
    },
    {
        id: 'count-high-roller',
        category: 'count',
        title: 'High Roller',
        description: 'Complete 5,000 solves.',
        targetValue: 5000,
        unit: 'solves'
    },
    {
        id: 'count-tenner',
        category: 'count',
        title: 'Tenner',
        description: 'Complete 10,000 solves.',
        targetValue: 10000,
        unit: 'solves'
    },
    {
        id: 'count-marathon-runner',
        category: 'count',
        title: 'Marathon Runner',
        description: 'Complete 25,000 solves.',
        targetValue: 25000,
        unit: 'solves'
    },
    {
        id: 'count-fifty-k',
        category: 'count',
        title: 'The Fifty-K Club',
        description: 'Complete 50,000 solves.',
        targetValue: 50000,
        unit: 'solves'
    },
    {
        id: 'count-immortal-hands',
        category: 'count',
        title: 'Immortal Hands',
        description: 'Complete 100,000 solves.',
        targetValue: 100000,
        unit: 'solves'
    },

    // Category 3: Streaks & Daily Volume
    {
        id: 'streak-habit-former',
        category: 'streak',
        title: 'Habit Former',
        description: 'Solve at least 1 cube per day for 7 consecutive days.',
        targetValue: 7,
        unit: 'days'
    },
    {
        id: 'streak-two-week-spark',
        category: 'streak',
        title: 'Two-Week Spark',
        description: 'Solve at least 5 solves per day for 14 consecutive days.',
        targetValue: 14,
        unit: 'days'
    },
    {
        id: 'streak-monthly-ritual',
        category: 'streak',
        title: 'Monthly Ritual',
        description: 'Solve at least 5 solves per day for 30 consecutive days.',
        targetValue: 30,
        unit: 'days'
    },
    {
        id: 'streak-quarterly-routine',
        category: 'streak',
        title: 'Quarterly Routine',
        description: 'Solve at least 5 solves per day for 90 consecutive days.',
        targetValue: 90,
        unit: 'days'
    },
    {
        id: 'streak-dedicated-daily',
        category: 'streak',
        title: 'Dedicated Daily',
        description: 'Solve at least 10 solves per day for 60 consecutive days.',
        targetValue: 60,
        unit: 'days'
    },
    {
        id: 'streak-half-year-habit',
        category: 'streak',
        title: 'Half-Year Habit',
        description: 'Solve at least 5 solves per day for 180 consecutive days.',
        targetValue: 180,
        unit: 'days'
    },
    {
        id: 'streak-year-in-twists',
        category: 'streak',
        title: 'A Year in Twists',
        description: 'Solve at least 1 solve per day for 365 consecutive days.',
        targetValue: 365,
        unit: 'days'
    },
    {
        id: 'streak-unbroken-year',
        category: 'streak',
        title: 'Unbroken Year',
        description: 'Solve at least 10 solves per day for 365 consecutive days.',
        targetValue: 365,
        unit: 'days'
    },
    {
        id: 'streak-weekend-blitz',
        category: 'streak',
        title: 'Weekend Blitz',
        description: 'Complete at least 50 solves per day for 3 consecutive days.',
        targetValue: 3,
        unit: 'days'
    },
    {
        id: 'streak-grind-week',
        category: 'streak',
        title: 'Grind Week',
        description: 'Complete at least 50 solves per day for 7 consecutive days.',
        targetValue: 7,
        unit: 'days'
    },
    {
        id: 'streak-century-run',
        category: 'streak',
        title: 'Century Run',
        description: 'Complete at least 100 solves per day for 7 consecutive days.',
        targetValue: 7,
        unit: 'days'
    },
    {
        id: 'streak-fortnight-forge',
        category: 'streak',
        title: 'Fortnight Forge',
        description: 'Complete at least 100 solves per day for 14 consecutive days.',
        targetValue: 14,
        unit: 'days'
    },
    {
        id: 'streak-iron-fingers',
        category: 'streak',
        title: 'Iron Fingers',
        description: 'Complete at least 100 solves per day for 30 consecutive days.',
        targetValue: 30,
        unit: 'days'
    },
    {
        id: 'streak-hardcore-session',
        category: 'streak',
        title: 'Hardcore Session',
        description: 'Complete at least 250 solves in a single calendar day.',
        targetValue: 250,
        unit: 'solves'
    },
    {
        id: 'streak-marathon-maniac',
        category: 'streak',
        title: 'Marathon Maniac',
        description: 'Complete at least 500 solves in a single calendar day.',
        targetValue: 500,
        unit: 'solves'
    },
    {
        id: 'streak-extreme-focus',
        category: 'streak',
        title: 'Extreme Focus',
        description: 'Complete at least 200 solves per day for 7 consecutive days.',
        targetValue: 7,
        unit: 'days'
    },

    // Category 4: Diversity & Event Breadth
    {
        id: 'diversity-branching-out',
        category: 'diversity',
        title: 'Branching Out',
        description: 'Record at least 1 valid solve in 3 different events.',
        targetValue: 3,
        unit: 'events'
    },
    {
        id: 'diversity-halfway-polyhedrons',
        category: 'diversity',
        title: 'Halfway Through the Polyhedrons',
        description: 'Record at least 1 solve in 8 different events.',
        targetValue: 8,
        unit: 'events'
    },
    {
        id: 'diversity-decathlon',
        category: 'diversity',
        title: 'Decathlon',
        description: 'Record a valid time in 10 different events.',
        targetValue: 10,
        unit: 'events'
    },
    {
        id: 'diversity-all-events',
        category: 'diversity',
        title: 'All-Event Completionist',
        description: 'Record at least 1 valid solve in all 15 supported events.',
        targetValue: 15,
        unit: 'events'
    },
    {
        id: 'diversity-blind-ambition',
        category: 'diversity',
        title: 'Blind Ambition',
        description: 'Complete your first Blindfolded (3BLD, 4BLD, 5BLD, or MBLD) solve.',
        targetValue: 1,
        unit: 'solve'
    },
    {
        id: 'diversity-big-cube-enthusiast',
        category: 'diversity',
        title: 'Big Cube Enthusiast',
        description: 'Log a valid solve in 4x4, 5x5, 6x6, and 7x7.',
        targetValue: 4,
        unit: 'cubes'
    },
    {
        id: 'diversity-side-event-sampler',
        category: 'diversity',
        title: 'Side Event Sampler',
        description: 'Log a valid solve in Pyraminx, Megaminx, Skewb, Square-1, and Clock.',
        targetValue: 5,
        unit: 'events'
    },
    {
        id: 'diversity-wca-novice',
        category: 'diversity',
        title: 'WCA Novice',
        description: 'Establish a valid Ao5 in 5 different events.',
        targetValue: 5,
        unit: 'events'
    },
    {
        id: 'diversity-balanced-arsenal',
        category: 'diversity',
        title: 'Balanced Arsenal',
        description: 'Establish a valid Ao12 in at least 5 different events.',
        targetValue: 5,
        unit: 'events'
    },
    {
        id: 'diversity-versatile-specialist',
        category: 'diversity',
        title: 'Versatile Specialist',
        description: 'Establish a valid Ao12 in at least 10 different events.',
        targetValue: 10,
        unit: 'events'
    },
    {
        id: 'diversity-grandmaster-many',
        category: 'diversity',
        title: 'Grandmaster of Many',
        description: 'Establish a valid Ao100 across 5 different events.',
        targetValue: 5,
        unit: 'events'
    },
    {
        id: 'diversity-big-cube-master',
        category: 'diversity',
        title: 'Big Cube Master',
        description: 'Establish a valid Ao12 in 4x4, 5x5, 6x6, and 7x7.',
        targetValue: 4,
        unit: 'cubes'
    },
    {
        id: 'diversity-side-event-specialist',
        category: 'diversity',
        title: 'Side Event Specialist',
        description: 'Establish a valid Ao12 in Megaminx, Pyraminx, Skewb, Square-1, and Clock.',
        targetValue: 5,
        unit: 'events'
    },
    {
        id: 'diversity-deca-session',
        category: 'diversity',
        title: 'Deca-Session',
        description: 'Record an Ao100 in 10 different events.',
        targetValue: 10,
        unit: 'events'
    },
    {
        id: 'diversity-polymath',
        category: 'diversity',
        title: 'Polymath',
        description: 'Establish a valid Ao12 in every supported event that supports average rankings.',
        targetValue: 11,
        unit: 'events'
    },
    {
        id: 'diversity-all-keybinds',
        category: 'diversity',
        title: 'Keybind Virtuoso',
        description: 'Use all navigation, timer, and scrambler keybinds at least once.',
        targetValue: 21,
        unit: 'keybinds'
    }
];

export const CATEGORY_METADATA: Record<GoalCategory, { label: string; description: string }> = {
    time: {
        label: 'Time',
        description: 'Accumulate solving time across all your sessions and events.'
    },
    count: {
        label: 'Solves',
        description: 'Reach high-volume solve milestones on your speedcubing journey.'
    },
    streak: {
        label: 'Streaks',
        description: 'Consistency tiers and high-volume daily solve grinds.'
    },
    diversity: {
        label: 'Breadth',
        description: 'Mastery across different events, big cubes, side events, and blindfolded.'
    }
};

export const ALL_TRACKED_KEYBINDS = [
    'Escape', 'b', 'g', 'l', 's', 'a', 'Tab', 'Shift',
    'Space', 'd', 'f',
    '1', '2', '3', '4', '5', '6', '7', 'c', 'm', 'p', 'k'
] as const;

export function formatTimeMs(ms: number): string {
    const totalMinutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours >= 1000) {
        return `${hours.toLocaleString()}h`;
    }
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
}

export interface StreakResult {
    maxStreak: number;
    startDate: string | null;
    endDate: string | null;
}

export function formatStreakDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr + 'T12:00:00');
        return format(d, 'MMM d, yyyy');
    } catch {
        return dateStr;
    }
}

function calculateMaxStreak(dateCounts: Map<string, number>, minSolvesPerDay: number): StreakResult {
    const qualifyingDates = Array.from(dateCounts.entries())
        .filter(([, count]) => count >= minSolvesPerDay)
        .map(([dateStr]) => ({
            dateStr,
            time: new Date(dateStr + 'T00:00:00Z').getTime()
        }))
        .sort((a, b) => a.time - b.time);

    if (qualifyingDates.length === 0) {
        return { maxStreak: 0, startDate: null, endDate: null };
    }

    const oneDayMs = 24 * 60 * 60 * 1000;
    let maxStreak = 1;
    let bestStartStr = qualifyingDates[0].dateStr;
    let bestEndStr = qualifyingDates[0].dateStr;

    let currentStreak = 1;
    let currentStartStr = qualifyingDates[0].dateStr;
    let currentEndStr = qualifyingDates[0].dateStr;

    for (let i = 1; i < qualifyingDates.length; i++) {
        const prev = qualifyingDates[i - 1];
        const curr = qualifyingDates[i];
        const diffDays = Math.round((curr.time - prev.time) / oneDayMs);

        if (diffDays === 1) {
            currentStreak++;
            currentEndStr = curr.dateStr;
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
                bestStartStr = currentStartStr;
                bestEndStr = currentEndStr;
            }
        } else if (diffDays > 1) {
            currentStreak = 1;
            currentStartStr = curr.dateStr;
            currentEndStr = curr.dateStr;
        }
    }

    return {
        maxStreak,
        startDate: formatStreakDate(bestStartStr),
        endDate: formatStreakDate(bestEndStr)
    };
}

export function evaluateUserGoals(solves: Solve[], user?: any | null, usedKeybinds: string[] = []): GoalProgress[] {
    // 1. Total Solve Time (ms) from non-DNF solves
    const totalSolveTimeMs = solves.reduce((acc, curr) => {
        if (curr.penalty === 'DNF' || curr.inspectionPenalty === 'DNF') return acc;
        let t = curr.time;
        if (curr.penalty === '+2') t += 2000;
        if (curr.inspectionPenalty === '+2') t += 2000;
        return acc + t;
    }, 0);

    // 2. Total Solves
    const totalSolvesCount = solves.length;

    // 3. Solves grouped by date (YYYY-MM-DD)
    const dailySolvesCount = new Map<string, number>();
    solves.forEach(s => {
        const d = new Date(s.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dailySolvesCount.set(key, (dailySolvesCount.get(key) || 0) + 1);
    });

    let maxSolvesInSingleDay = 0;
    let maxDayDate: string | null = null;
    dailySolvesCount.forEach((count, dateStr) => {
        if (count > maxSolvesInSingleDay) {
            maxSolvesInSingleDay = count;
            maxDayDate = dateStr;
        }
    });

    // 4. Solves grouped by event
    const solvesByEvent: Record<string, Solve[]> = {};
    SUPPORTED_EVENT_IDS.forEach(id => {
        solvesByEvent[id] = [];
    });

    solves.forEach(s => {
        const type = s.scrambleType || '333';
        if (!solvesByEvent[type]) {
            solvesByEvent[type] = [];
        }
        solvesByEvent[type].push(s);
    });

    // Valid solve count per event (non-DNF)
    const validSolvesPerEvent: Record<string, number> = {};
    const hasAo5PerEvent: Record<string, boolean> = {};
    const hasAo12PerEvent: Record<string, boolean> = {};
    const hasAo100PerEvent: Record<string, boolean> = {};

    let totalEventsWithAo100 = 0;
    let anyAo100Completed = false;

    SUPPORTED_EVENT_IDS.forEach(eventId => {
        const list = solvesByEvent[eventId] || [];
        const validCount = list.filter(s => s.penalty !== 'DNF' && s.inspectionPenalty !== 'DNF').length;
        validSolvesPerEvent[eventId] = validCount;

        const bestAo5 = calculateBestAverage(list, 5);
        const bestAo12 = calculateBestAverage(list, 12);
        const bestAo100 = calculateBestAverage(list, 100);

        hasAo5PerEvent[eventId] = bestAo5 !== null && bestAo5 !== 'DNF';
        hasAo12PerEvent[eventId] = bestAo12 !== null && bestAo12 !== 'DNF';
        hasAo100PerEvent[eventId] = bestAo100 !== null && bestAo100 !== 'DNF';

        if (hasAo100PerEvent[eventId]) {
            totalEventsWithAo100++;
            anyAo100Completed = true;
        }
    });

    const eventsWithValidSolve = SUPPORTED_EVENT_IDS.filter(id => (validSolvesPerEvent[id] || 0) >= 1).length;
    const eventsWithValidAo5 = SUPPORTED_EVENT_IDS.filter(id => hasAo5PerEvent[id]).length;
    const eventsWithValidAo12 = SUPPORTED_EVENT_IDS.filter(id => hasAo12PerEvent[id]).length;

    // Big cubes: 444, 555, 666, 777
    const bigCubeIds = ['444', '555', '666', '777'];
    const bigCubesWithSolve = bigCubeIds.filter(id => (validSolvesPerEvent[id] || 0) >= 1).length;
    const bigCubesWithAo12 = bigCubeIds.filter(id => hasAo12PerEvent[id]).length;

    // Side events: minx, pyram, skewb, sq1, clock
    const sideEventIds = ['minx', 'pyram', 'skewb', 'sq1', 'clock'];
    const sideEventsWithSolve = sideEventIds.filter(id => (validSolvesPerEvent[id] || 0) >= 1).length;
    const sideEventsWithAo12 = sideEventIds.filter(id => hasAo12PerEvent[id]).length;

    // Blindfolded: 333bf, 444bf, 555bf, 333mbf
    const bldEventIds = ['333bf', '444bf', '555bf', '333mbf'];
    const hasBldSolve = bldEventIds.some(id => (validSolvesPerEvent[id] || 0) >= 1) ? 1 : 0;

    // Averageable events Ao12 count
    const averageableAo12Count = AVERAGEABLE_EVENT_IDS.filter(id => hasAo12PerEvent[id]).length;

    // Unique keybind count
    const uniqueKeybindsCount = new Set(usedKeybinds).size;

    // Map each definition to progress
    return GOAL_DEFINITIONS.map(def => {
        let currentValue = 0;
        let displayCurrent = '';
        let displayTarget = '';
        let streakStartDate: string | null = null;
        let streakEndDate: string | null = null;

        switch (def.id) {
            // Category 1: Time Spent
            case 'time-create-account':
                currentValue = user ? 1 : 0;
                displayCurrent = user ? '1' : '0';
                displayTarget = '1';
                break;
            case 'time-warm-hands':
            case 'time-first-session':
            case 'time-deep-focus':
            case 'time-double-digits':
            case 'time-full-rotation':
            case 'time-weekend-warrior':
            case 'time-centurion':
            case 'time-quarter-k':
            case 'time-halftime':
            case 'time-1000-hours':
            case 'time-master':
                currentValue = totalSolveTimeMs;
                displayCurrent = formatTimeMs(totalSolveTimeMs);
                displayTarget = formatTimeMs(def.targetValue);
                break;

            // Category 2: Count
            case 'count-first-turn':
            case 'count-quick-ten':
            case 'count-warmup':
            case 'count-century-club':
            case 'count-getting-serious':
            case 'count-half-a-grand':
            case 'count-millennium':
            case 'count-five-digit':
            case 'count-high-roller':
            case 'count-tenner':
            case 'count-marathon-runner':
            case 'count-fifty-k':
            case 'count-immortal-hands':
                currentValue = totalSolvesCount;
                displayCurrent = totalSolvesCount.toLocaleString();
                displayTarget = def.targetValue.toLocaleString();
                break;

            case 'count-ao100-unlocked':
                currentValue = anyAo100Completed ? 1 : 0;
                displayCurrent = anyAo100Completed ? '1' : '0';
                displayTarget = '1';
                break;

            // Category 3: Streaks & Daily Volume
            case 'streak-habit-former': {
                const res = calculateMaxStreak(dailySolvesCount, 1);
                currentValue = res.maxStreak;
                streakStartDate = res.startDate;
                streakEndDate = res.endDate;
                displayCurrent = `${currentValue} days`;
                displayTarget = `${def.targetValue} days`;
                break;
            }
            case 'streak-two-week-spark':
            case 'streak-monthly-ritual':
            case 'streak-quarterly-routine':
            case 'streak-half-year-habit': {
                const res = calculateMaxStreak(dailySolvesCount, 5);
                currentValue = res.maxStreak;
                streakStartDate = res.startDate;
                streakEndDate = res.endDate;
                displayCurrent = `${currentValue} days`;
                displayTarget = `${def.targetValue} days`;
                break;
            }
            case 'streak-dedicated-daily':
            case 'streak-unbroken-year': {
                const res = calculateMaxStreak(dailySolvesCount, 10);
                currentValue = res.maxStreak;
                streakStartDate = res.startDate;
                streakEndDate = res.endDate;
                displayCurrent = `${currentValue} days`;
                displayTarget = `${def.targetValue} days`;
                break;
            }
            case 'streak-year-in-twists': {
                const res = calculateMaxStreak(dailySolvesCount, 1);
                currentValue = res.maxStreak;
                streakStartDate = res.startDate;
                streakEndDate = res.endDate;
                displayCurrent = `${currentValue} days`;
                displayTarget = `${def.targetValue} days`;
                break;
            }
            case 'streak-weekend-blitz':
            case 'streak-grind-week': {
                const res = calculateMaxStreak(dailySolvesCount, 50);
                currentValue = res.maxStreak;
                streakStartDate = res.startDate;
                streakEndDate = res.endDate;
                displayCurrent = `${currentValue} days`;
                displayTarget = `${def.targetValue} days`;
                break;
            }
            case 'streak-century-run':
            case 'streak-fortnight-forge':
            case 'streak-iron-fingers': {
                const res = calculateMaxStreak(dailySolvesCount, 100);
                currentValue = res.maxStreak;
                streakStartDate = res.startDate;
                streakEndDate = res.endDate;
                displayCurrent = `${currentValue} days`;
                displayTarget = `${def.targetValue} days`;
                break;
            }
            case 'streak-hardcore-session':
            case 'streak-marathon-maniac': {
                currentValue = maxSolvesInSingleDay;
                if (maxSolvesInSingleDay > 0 && maxDayDate) {
                    streakStartDate = formatStreakDate(maxDayDate);
                    streakEndDate = formatStreakDate(maxDayDate);
                }
                displayCurrent = `${currentValue.toLocaleString()} solves`;
                displayTarget = `${def.targetValue.toLocaleString()} solves`;
                break;
            }
            case 'streak-extreme-focus': {
                const res = calculateMaxStreak(dailySolvesCount, 200);
                currentValue = res.maxStreak;
                streakStartDate = res.startDate;
                streakEndDate = res.endDate;
                displayCurrent = `${currentValue} days`;
                displayTarget = `${def.targetValue} days`;
                break;
            }

            // Category 4: Diversity & Event Breadth
            case 'diversity-branching-out':
            case 'diversity-halfway-polyhedrons':
            case 'diversity-decathlon':
            case 'diversity-all-events':
                currentValue = eventsWithValidSolve;
                displayCurrent = `${currentValue} events`;
                displayTarget = `${def.targetValue} events`;
                break;
            case 'diversity-blind-ambition':
                currentValue = hasBldSolve;
                displayCurrent = hasBldSolve ? '1 solve' : '0 solves';
                displayTarget = '1 solve';
                break;
            case 'diversity-big-cube-enthusiast':
                currentValue = bigCubesWithSolve;
                displayCurrent = `${currentValue} / 4`;
                displayTarget = '4 cubes';
                break;
            case 'diversity-side-event-sampler':
                currentValue = sideEventsWithSolve;
                displayCurrent = `${currentValue} / 5`;
                displayTarget = '5 events';
                break;
            case 'diversity-wca-novice':
                currentValue = eventsWithValidAo5;
                displayCurrent = `${currentValue} events`;
                displayTarget = `${def.targetValue} events`;
                break;
            case 'diversity-balanced-arsenal':
            case 'diversity-versatile-specialist':
                currentValue = eventsWithValidAo12;
                displayCurrent = `${currentValue} events`;
                displayTarget = `${def.targetValue} events`;
                break;
            case 'diversity-grandmaster-many':
            case 'diversity-deca-session':
                currentValue = totalEventsWithAo100;
                displayCurrent = `${currentValue} events`;
                displayTarget = `${def.targetValue} events`;
                break;
            case 'diversity-big-cube-master':
                currentValue = bigCubesWithAo12;
                displayCurrent = `${currentValue} / 4`;
                displayTarget = '4 cubes';
                break;
            case 'diversity-side-event-specialist':
                currentValue = sideEventsWithAo12;
                displayCurrent = `${currentValue} / 5`;
                displayTarget = '5 events';
                break;
            case 'diversity-polymath':
                currentValue = averageableAo12Count;
                displayCurrent = `${currentValue} / 11`;
                displayTarget = '11 events';
                break;
            case 'diversity-all-keybinds':
                currentValue = Math.min(21, uniqueKeybindsCount);
                displayCurrent = `${currentValue} / 21`;
                displayTarget = '21 keybinds';
                break;
            default:
                break;
        }

        const completed = currentValue >= def.targetValue;
        const rawPercent = (currentValue / def.targetValue) * 100;
        const percentCompleted = completed ? 100 : Math.min(99.9, Math.max(0, Math.round(rawPercent * 10) / 10));

        return {
            goalId: def.id,
            category: def.category,
            title: def.title,
            description: def.description,
            currentValue,
            targetValue: def.targetValue,
            completed,
            percentCompleted,
            displayCurrent,
            displayTarget,
            streakStartDate,
            streakEndDate
        };
    });
}
