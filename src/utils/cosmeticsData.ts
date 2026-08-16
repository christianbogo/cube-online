import type { ColorLadderItem, CosmeticItem, GachaBoxConfig, CosmeticRarity } from '../types/economy';

export const STARTING_COLOR = '#ef4444';

// Exponential Color Price Ladder
export const COLOR_LADDER: ColorLadderItem[] = [
    {
        id: 'red',
        name: 'Crimson Red',
        hex: '#ef4444',
        price: 0,
        description: 'Your default signature color. Always unlocked and ready to solve.'
    },
    {
        id: 'orange',
        name: 'Tangerine Orange',
        hex: '#f97316',
        price: 50,
        description: 'Vibrant and energetic. For cubers who warm up fast.'
    },
    {
        id: 'amber',
        name: 'Amber Gold',
        hex: '#f59e0b',
        price: 250,
        description: 'Rich warm amber. Shows you have a few hundred coins to spare.'
    },
    {
        id: 'green',
        name: 'Emerald Lime',
        hex: '#10b981',
        price: 1000,
        description: 'Crisp green hue. The color of clean execution and zero lockups.'
    },
    {
        id: 'cyan',
        name: 'Electric Cyan',
        hex: '#06b6d4',
        price: 5000,
        description: 'High-voltage electric blue. Cool under competition pressure.'
    },
    {
        id: 'blue',
        name: 'Deep Sapphire',
        hex: '#3b82f6',
        price: 25000,
        description: 'Classic royal speedcubing blue. Worn by dedicated solvers.'
    },
    {
        id: 'purple',
        name: 'Royal Violet',
        hex: '#8b5cf6',
        price: 125000,
        description: 'Deep regal purple. A status symbol for serious streak riders.'
    },
    {
        id: 'pink',
        name: 'Neon Magenta',
        hex: '#ec4899',
        price: 625000,
        description: 'Radiant neon pink. Stand out across the entire live room.'
    },
    {
        id: 'slate',
        name: 'Cyber Slate',
        hex: '#64748b',
        price: 3000000,
        description: 'Sleek brushed titanium. Reserved for multi-million coin grinders.'
    },
    {
        id: 'obsidian',
        name: 'Obsidian Void',
        hex: '#18181b',
        price: 15000000,
        description: 'Pitch-black obsidian depth. Dark, stealthy, and intimidating.'
    },
    {
        id: 'gold',
        name: 'Holographic Gold',
        hex: '#ffd700',
        price: 75000000,
        description: 'Pure liquid bullion gold. A high-roller flex of ultimate wealth.'
    },
    {
        id: 'plasma',
        name: 'Quantum Plasma',
        hex: '#818cf8',
        price: 250000000,
        description: 'Pulsing quantum indigo. Only accessible to legendary gamblers.'
    },
    {
        id: 'red_circle',
        name: 'The Red Circle',
        hex: '#dc2626',
        price: 1000000000,
        isImpossible: true,
        description: 'A singular, minimalist red circle. Rumored to require a billion solves to attain. Practically impossible to ever afford.'
    }
];

// Cosmetics Catalog for Gacha Capsules
export const COSMETICS_CATALOG: CosmeticItem[] = [
    // --- Titles / Badges ---
    { id: 'title-cfop', name: 'CFOP Novice', description: 'Just learned cross and F2L.', category: 'title', rarity: 'common', value: 'CFOP Novice' },
    { id: 'title-cutter', name: 'Corner Cutter', description: 'Pushing 45-degree cuts to the limit.', category: 'title', rarity: 'common', value: 'Corner Cutter' },
    { id: 'title-tps', name: 'TPS Grinder', description: 'Turning fast, thinking later.', category: 'title', rarity: 'common', value: 'TPS Grinder' },
    { id: 'title-masher', name: 'Timer Masher', description: 'Hits the spacebar with excessive force.', category: 'title', rarity: 'common', value: 'Timer Masher' },

    { id: 'title-sub20', name: 'Sub-20 Demon', description: 'Consistently breaking the 20-second barrier.', category: 'title', rarity: 'rare', value: 'Sub-20 Demon' },
    { id: 'title-f2l', name: 'F2L Wizard', description: 'Pairing corners and edges without rotation.', category: 'title', rarity: 'rare', value: 'F2L Wizard' },
    { id: 'title-algo', name: 'Algorithm Addict', description: 'Memorized full ZBLL just for fun.', category: 'title', rarity: 'rare', value: 'Algorithm Addict' },
    { id: 'title-cross', name: 'Cross Master', description: 'Plans the entire cross in 3 seconds flat.', category: 'title', rarity: 'rare', value: 'Cross Master' },

    { id: 'title-fingertrick', name: 'Fingertrick Phenom', description: 'Fluid double flicks and silent turns.', category: 'title', rarity: 'epic', value: 'Fingertrick Phenom' },
    { id: 'title-zerolockup', name: 'Zero Lockup', description: 'Pure mechanical accuracy in every solve.', category: 'title', rarity: 'epic', value: 'Zero Lockup' },
    { id: 'title-wca', name: 'WCA Hopeful', description: 'Ready to bring home national records.', category: 'title', rarity: 'epic', value: 'WCA Hopeful' },
    { id: 'title-rage', name: 'Rage Machine', description: 'Forged in the fires of +2 penalties.', category: 'title', rarity: 'epic', value: 'Rage Machine' },

    { id: 'title-god', name: 'God of Permutations', description: 'Bends the cube to pure will.', category: 'title', rarity: 'legendary', value: 'God of Permutations' },
    { id: 'title-sub10', name: 'Sub-10 Overlord', description: 'Single digits are merely a routine.', category: 'title', rarity: 'legendary', value: 'Sub-10 Overlord' },
    { id: 'title-chosen', name: 'The Chosen Cuber', description: 'Anointed by the RNG deities of scramble.', category: 'title', rarity: 'legendary', value: 'The Chosen Cuber' },
    { id: 'title-highroller', name: 'Casino High Roller', description: 'Risks everything on every solve.', category: 'title', rarity: 'legendary', value: 'Casino High Roller' },

    // --- Color Themes ---
    { id: 'theme-synthwave', name: 'Synthwave Sunset', description: 'Neon violet and hot magenta cyberpunk aesthetics.', category: 'theme', rarity: 'rare', value: 'theme-synthwave' },
    { id: 'theme-cyberpunk', name: 'Cyberpunk 2077', description: 'High contrast electric yellow and cyan glowing UI.', category: 'theme', rarity: 'rare', value: 'theme-cyberpunk' },
    { id: 'theme-matrix', name: 'Matrix Terminal', description: 'Phosphor green CRT matrix terminal styling.', category: 'theme', rarity: 'epic', value: 'theme-matrix' },
    { id: 'theme-blood', name: 'Blood Ruby', description: 'Deep crimson and obsidian dark mode.', category: 'theme', rarity: 'epic', value: 'theme-blood' },
    { id: 'theme-holographic', name: 'Holographic Void', description: 'Prismatic shifting cosmic aura and gradient accents.', category: 'theme', rarity: 'legendary', value: 'theme-holographic' },

    // --- Sound Effects Packs ---
    { id: 'sound-mechanical', name: 'Cherry MX Blue', description: 'Tactile, clicky mechanical keyboard switches.', category: 'sound', rarity: 'rare', value: 'mechanical' },
    { id: 'sound-retro8bit', name: '8-Bit Retro Arcade', description: 'Nostalgic chiptune blips and arcade cues.', category: 'sound', rarity: 'rare', value: 'retro8bit' },
    { id: 'sound-cyber', name: 'Cyber Sci-Fi', description: 'Futuristic warp engines and digital chimes.', category: 'sound', rarity: 'epic', value: 'cyber' },
    { id: 'sound-casino', name: 'Casino Royale', description: 'Authentic slot machine bells, coins, and fanfare.', category: 'sound', rarity: 'legendary', value: 'casino' },

    // --- Scramble Visualizer Cube Skins ---
    { id: 'skin-pastel', name: 'Soft Pastel Cube', description: 'Smooth, soothing matte pastel colorway.', category: 'cubeSkin', rarity: 'rare', value: 'pastel' },
    { id: 'skin-carbon', name: 'Carbon Fiber Weave', description: 'Ultra-lightweight racing carbon fiber stickers.', category: 'cubeSkin', rarity: 'epic', value: 'carbon' },
    { id: 'skin-neon', name: 'Neon Luminescence', description: 'Glow-in-the-dark radioactive edge accents.', category: 'cubeSkin', rarity: 'epic', value: 'neon' },
    { id: 'skin-hologram', name: 'Celestial Hologram', description: 'Iridescent 3D holographic projection.', category: 'cubeSkin', rarity: 'legendary', value: 'hologram' }
];

export const GACHA_BOXES: GachaBoxConfig[] = [
    {
        id: 'standard',
        name: 'Standard Capsule',
        description: 'Affordable capsule containing common to rare cosmetics with a lucky chance for epics.',
        cost: 100,
        currency: 'coins'
    },
    {
        id: 'high_roller',
        name: 'High Roller Capsule',
        description: 'Premium capsule with guaranteed Rare or better cosmetics and boosted Legendary drop rates.',
        cost: 500,
        currency: 'coins',
        guaranteedMinRarity: 'rare'
    },
    {
        id: 'heartbreak',
        name: 'Heartbreak Pity Crate',
        description: 'Openable only with tokens earned from heartbreaking near-misses. Guaranteed Epic or Legendary!',
        cost: 3,
        currency: 'heartbreak',
        guaranteedMinRarity: 'epic'
    }
];

// RNG Gacha Pull Algorithm
export function performGachaPull(boxType: 'standard' | 'high_roller' | 'heartbreak', alreadyUnlockedIds: string[]): { item: CosmeticItem; isDuplicate: boolean; duplicateCompensation: number } {
    let rarity: CosmeticRarity = 'common';
    const rand = Math.random() * 100;

    if (boxType === 'heartbreak') {
        // Pity Crate: 75% Epic, 25% Legendary
        rarity = rand < 25 ? 'legendary' : 'epic';
    } else if (boxType === 'high_roller') {
        // High Roller: 65% Rare, 27% Epic, 8% Legendary
        if (rand < 8) rarity = 'legendary';
        else if (rand < 35) rarity = 'epic';
        else rarity = 'rare';
    } else {
        // Standard: 60% Common, 25% Rare, 12% Epic, 3% Legendary
        if (rand < 3) rarity = 'legendary';
        else if (rand < 15) rarity = 'epic';
        else if (rand < 40) rarity = 'rare';
        else rarity = 'common';
    }

    // Filter items of this rarity
    const matchingItems = COSMETICS_CATALOG.filter(c => c.rarity === rarity);
    const item = matchingItems[Math.floor(Math.random() * matchingItems.length)] || COSMETICS_CATALOG[0];

    const isDuplicate = alreadyUnlockedIds.includes(item.id);
    let duplicateCompensation = 0;
    if (isDuplicate) {
        switch (item.rarity) {
            case 'legendary': duplicateCompensation = 350; break;
            case 'epic': duplicateCompensation = 150; break;
            case 'rare': duplicateCompensation = 60; break;
            case 'common': duplicateCompensation = 25; break;
        }
    }

    return { item, isDuplicate, duplicateCompensation };
}
