import { doc, getDoc, updateDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface UserScrambleStats {
    loot_chance_modifier: number;
    completed_years: string[];
    completed_months: string[];
    completed_weeks: string[];

    completed_days: string[];
    completed_hours: string[];
}

interface ScrambleResult {
    scramble: string;
    type: 'normal' | 'y' | 'm' | 'w' | 'd' | 'h';
    id?: string;
}

export const BASE_RATE = 0.60;
export const LOOT_WEIGHTS = { h: 2000, d: 250, w: 50, m: 10, y: 1 };

// Helper to get consistent ISO strings
const getISO = (date: Date) => date.toISOString().split('T')[0];
const getISOHour = (date: Date) => {
    const iso = date.toISOString();
    return iso.split('T')[0] + '-' + iso.split('T')[1].split(':')[0];
};

export async function getDailyScramble(userId: string): Promise<ScrambleResult> {
    if (!userId) return { scramble: '', type: 'normal' };

    // 1. Fetch User Stats
    const userStatsRef = doc(db, 'users', userId, 'private', 'scrambleStats');
    let stats: UserScrambleStats;

    try {
        const snap = await getDoc(userStatsRef);
        if (snap.exists()) {
            stats = snap.data() as UserScrambleStats;
        } else {
            // Initialize defaults
            stats = {
                loot_chance_modifier: 0.05,
                completed_years: [],
                completed_months: [],
                completed_weeks: [],
                completed_days: [],
                completed_hours: []
            };
            await setDoc(userStatsRef, stats);
        }
    } catch (e) {
        console.error("Error fetching stats, fallback to normal", e);
        return { scramble: '', type: 'normal' };
    }

    // 2. Phase A: The Trigger
    const roll = Math.random();
    const chance = BASE_RATE + (stats.loot_chance_modifier || 0);

    if (roll >= chance) {
        // Failed roll - increment modifier
        await updateDoc(userStatsRef, {
            loot_chance_modifier: (stats.loot_chance_modifier || 0) + 0.05
        });
        return { scramble: '', type: 'normal' };
    }

    // Success! Reset modifier
    await updateDoc(userStatsRef, { loot_chance_modifier: 0 });

    // 3. Phase B: Candidate Selection & Phase C: Weighted Roll
    // Simplified Logic for NOW:
    // Determine Type based on simple weights first, then find ID.
    // Weights: Hour (2000), Day (250), Week (50), Month (10), Year (1)

    const weights = LOOT_WEIGHTS;
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;

    let selectedType: 'h' | 'd' | 'w' | 'm' | 'y' = 'h';
    for (const [t, w] of Object.entries(weights)) {
        if (r < w) {
            selectedType = t as any;
            break;
        }
        r -= w;
    }

    // Generate ID for selected type
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    // Simple week number (approximation)
    const week = String(Math.ceil((now.getDate() + 6 - now.getDay()) / 7)).padStart(2, '0');
    const day = getISO(now);
    const hour = getISOHour(now);

    let id = '';
    // Check completion (Simple check against "last completed" for day/hour, array for others)
    // NOTE: This logic is simplified; real implementation needs full backlog check.
    // Assuming "Current" for now.

    if (selectedType === 'y') id = `y-${year}`;
    if (selectedType === 'm') id = `m-${year}-${month}`;
    if (selectedType === 'w') id = `w-${year}-${week}`; // Warning: week calculation varies
    if (selectedType === 'd') id = `d-${day}`;
    if (selectedType === 'h') id = `h-${hour}`;

    // Verify if already completed?
    // For simplicity in this first pass, we allow re-rolls or just serve it.
    // Ideally we check `stats.completed_years.includes(id)`.
    // If completed, we should degrade to 'normal' or find 'backlog'.
    // For MVP/first pass: if completed, degrade to normal.
    let isCompleted = false;
    if (selectedType === 'y' && stats.completed_years.includes(id)) isCompleted = true;
    if (selectedType === 'm' && stats.completed_months.includes(id)) isCompleted = true;
    if (selectedType === 'w' && stats.completed_weeks.includes(id)) isCompleted = true;
    if (selectedType === 'd' && stats.completed_days?.includes(id)) isCompleted = true;
    if (selectedType === 'h' && stats.completed_hours?.includes(id)) isCompleted = true;

    if (isCompleted) {
        // Fallback to normal (or implement backlog later)
        return { scramble: '', type: 'normal' };
    }

    // 4. Fetch Scramble content
    try {
        const response = await fetch(`/scrambles/scrambles-${year}.json`);
        if (!response.ok) throw new Error('Scramble file not found');
        const data = await response.json();

        const scrambleString = data[id];
        if (!scrambleString) return { scramble: '', type: 'normal' }; // ID not in file

        return { scramble: scrambleString, type: selectedType, id };
    } catch (e) {
        console.error("Error loading scramble file", e);
        return { scramble: '', type: 'normal' };
    }
}

export async function markScrambleComplete(userId: string, type: string, id: string) {
    if (!userId || !type || !id) return;
    const userStatsRef = doc(db, 'users', userId, 'private', 'scrambleStats');

    // Construct updates based on type
    const updates: any = {};
    if (type === 'y') updates.completed_years = arrayUnion(id);
    if (type === 'm') updates.completed_months = arrayUnion(id);
    if (type === 'w') updates.completed_weeks = arrayUnion(id);
    if (type === 'd') updates.completed_days = arrayUnion(id);
    if (type === 'h') updates.completed_hours = arrayUnion(id);

    await updateDoc(userStatsRef, updates);
}

export async function getUserScrambleStats(userId: string): Promise<UserScrambleStats | null> {
    if (!userId) return null;
    try {
        const snap = await getDoc(doc(db, 'users', userId, 'private', 'scrambleStats'));
        if (snap.exists()) return snap.data() as UserScrambleStats;
        return null;
    } catch (e) {
        console.error(e);
        return null;
    }
}
