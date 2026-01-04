import { doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
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



const GENESIS_DATE = new Date('2025-01-01T00:00:00Z');

// Helper to generate the "Pool" of potential IDs
function generateIdPool(type: 'h' | 'd' | 'w' | 'm' | 'y'): string[] {
    const pool: string[] = [];
    const now = new Date();
    let cursor = new Date(GENESIS_DATE);

    while (cursor <= now) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = cursor.toISOString().split('T')[0];

        if (type === 'y') {
            pool.push(`y-${y}`);
            cursor.setFullYear(cursor.getFullYear() + 1);
        }
        else if (type === 'm') {
            pool.push(`m-${y}-${m}`);
            cursor.setMonth(cursor.getMonth() + 1);
        }
        else if (type === 'w') {
            const week = String(Math.ceil((cursor.getDate() + 6 - cursor.getDay()) / 7)).padStart(2, '0');
            pool.push(`w-${y}-${week}`);
            cursor.setDate(cursor.getDate() + 7);
        }
        else if (type === 'd') {
            pool.push(`d-${d}`);
            cursor.setDate(cursor.getDate() + 1);
        }
        else if (type === 'h') {
            const h = cursor.toISOString().split('T')[1].split(':')[0];
            pool.push(`h-${d}-${h}`);
            cursor.setHours(cursor.getHours() + 1);
        }
    }
    return pool;
}

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
        await updateDoc(userStatsRef, {
            loot_chance_modifier: (stats.loot_chance_modifier || 0) + 0.05
        });
        return { scramble: '', type: 'normal' };
    }

    // Success! Reset modifier
    await updateDoc(userStatsRef, { loot_chance_modifier: 0 });

    // 3. Phase B: Candy Selection - Mining Logic

    // Determine Type
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

    // Generate Pool & Filter
    const fullPool = generateIdPool(selectedType);

    let completed: string[] = [];
    if (selectedType === 'y') completed = stats.completed_years || [];
    if (selectedType === 'm') completed = stats.completed_months || [];
    if (selectedType === 'w') completed = stats.completed_weeks || [];
    if (selectedType === 'd') completed = stats.completed_days || [];
    if (selectedType === 'h') completed = stats.completed_hours || [];

    const candidates = fullPool.filter(id => !completed.includes(id));

    if (candidates.length === 0) {
        return { scramble: '', type: 'normal' };
    }

    // 4. Phase C: Biased Selection
    const BIAS_FACTOR = 0.3;
    const biasedRandom = Math.pow(Math.random(), BIAS_FACTOR);
    const selectedIndex = Math.floor(candidates.length * biasedRandom);

    const selectedId = candidates[selectedIndex];

    // 5. Fetch Scramble content
    const idParts = selectedId.split('-');
    const scrambleYear = idParts[1];

    try {
        const response = await fetch(`/scrambles/scrambles-${scrambleYear}.json`);
        // Note: fetch paths in client-side code are relative to public/
        if (!response.ok) throw new Error(`Scramble file for ${scrambleYear} not found`);
        const data = await response.json();

        const scrambleString = data[selectedId];
        if (!scrambleString) {
            console.warn(`Scramble ID ${selectedId} not found in json`);
            return { scramble: '', type: 'normal' };
        }

        return { scramble: scrambleString, type: selectedType, id: selectedId };
    } catch (e) {
        console.error("Error loading scramble file", e);
        return { scramble: '', type: 'normal' };
    }
}

export async function markScrambleComplete(userId: string, type: string, id: string) {
    if (!userId || !type || !id) return;
    const userStatsRef = doc(db, 'users', userId, 'private', 'scrambleStats');

    const updates: any = {};
    if (type === 'y') updates.completed_years = arrayUnion(id);
    if (type === 'm') updates.completed_months = arrayUnion(id);
    if (type === 'w') updates.completed_weeks = arrayUnion(id);
    if (type === 'd') updates.completed_days = arrayUnion(id);
    if (type === 'h') updates.completed_hours = arrayUnion(id);

    await updateDoc(userStatsRef, updates);
}

export async function unmarkScrambleComplete(userId: string, type: string, id: string) {
    if (!userId || !type || !id) return;
    const userStatsRef = doc(db, 'users', userId, 'private', 'scrambleStats');

    const updates: any = {};
    if (type === 'y') updates.completed_years = arrayRemove(id);
    if (type === 'm') updates.completed_months = arrayRemove(id);
    if (type === 'w') updates.completed_weeks = arrayRemove(id);
    if (type === 'd') updates.completed_days = arrayRemove(id);
    if (type === 'h') updates.completed_hours = arrayRemove(id);

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
