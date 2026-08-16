// Economy, Store, and Gambling Mechanic Type Definitions

export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type CosmeticCategory = 'theme' | 'sound' | 'title' | 'cubeSkin';

export interface CosmeticItem {
    id: string;
    name: string;
    description: string;
    category: CosmeticCategory;
    rarity: CosmeticRarity;
    value?: string; // CSS class, sound pack id, badge text, visualizer skin id
}

export interface ColorLadderItem {
    id: string;
    name: string;
    hex: string;
    price: number;
    description: string;
    isImpossible?: boolean;
}

export interface ActiveWager {
    id: string;
    targetTime: number; // in milliseconds
    targetLabel: string; // e.g. "Sub-15.00s"
    wagerAmount: number;
    odds: number; // Multiplier, e.g. 2.5
    potentialPayout: number;
}

export interface PushYourLuckStreak {
    count: number;
    currentPot: number;
    isRiding: boolean;
    targetMaxTime: number | null; // Must be under this to multiply
}

export interface EconomyStats {
    totalGambled: number;
    totalWon: number;
    highestStreak: number;
    highestMultiplier: number;
    nearMissesCount: number;
    cratesOpened: number;
    totalCoinsEarned: number;
}

export interface EquippedCosmetics {
    theme: string;
    sound: string;
    title: string;
    cubeSkin: string;
}

export interface EconomyState {
    coins: number;
    heartbreakTokens: number;
    unlockedColors: string[]; // hex codes e.g. ['#ef4444']
    equippedColor: string;
    unlockedCosmetics: string[]; // cosmetic IDs
    equippedCosmetics: EquippedCosmetics;
    streak: PushYourLuckStreak;
    activeWager: ActiveWager | null;
    stats: EconomyStats;
}

export interface GamblingAlert {
    id: string;
    type: 'wager_win' | 'wager_loss' | 'streak_win' | 'streak_bust' | 'near_miss' | 'gacha_win';
    title: string;
    subtitle: string;
    amount?: number;
    tokenType?: 'coins' | 'heartbreak';
    rarity?: CosmeticRarity;
    timestamp: number;
}

export interface GachaBoxConfig {
    id: 'standard' | 'high_roller' | 'heartbreak';
    name: string;
    description: string;
    cost: number;
    currency: 'coins' | 'heartbreak';
    guaranteedMinRarity?: CosmeticRarity;
}
