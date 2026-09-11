import type { LiveUser } from '../types';

// Set to true whenever you want to test the UI with mock users
export const USE_MOCK_USERS = false;

export const ANIMATED_PROFILE_GRADIENTS = [
    'linear-gradient(135deg, #ef4444, #f97316, #f59e0b, #ef4444)', // Sunset Ember
    'linear-gradient(135deg, #059669, #0d9488, #0284c7, #6366f1, #059669)', // Northern Lights
    'linear-gradient(135deg, #4338ca, #7c3aed, #db2777, #4338ca)', // Cosmic Lavender
    'linear-gradient(135deg, #f72585, #7209b7, #3a0ca3, #4361ee, #f72585)', // Neon Cyberpunk
    'linear-gradient(135deg, #ea580c, #f59e0b, #eab308, #84cc16, #ea580c)', // Citrus Sunshine
    'linear-gradient(135deg, #00c6ff, #0072ff, #38bdf8, #0284c7, #00c6ff)', // Electric Ocean
    'linear-gradient(135deg, #10b981, #06b6d4, #3b82f6, #10b981)', // Bioluminescent Lagoon
    'linear-gradient(135deg, #fda4af, #f472b6, #fb7185, #f43f5e, #fda4af)', // Cherry Blossom
    'linear-gradient(135deg, #991b1b, #dc2626, #ea580c, #f97316, #991b1b)', // Molten Magma
    'linear-gradient(135deg, #312e81, #581c87, #831843, #4c1d95, #312e81)', // Royal Velvet
    'linear-gradient(135deg, #065f46, #10b981, #34d399, #6ee7b7, #065f46)', // Mint Fresh
    'linear-gradient(135deg, #0f172a, #1e293b, #334155, #1e1b4b, #0f172a)', // Deep Space Obsidian
    'linear-gradient(135deg, #b45309, #f59e0b, #fef08a, #d97706, #b45309)', // Gold Rush
    'linear-gradient(135deg, #fb7185, #f43f5e, #fda4af, #fed7aa, #fb7185)', // Peach Sorbet
    'linear-gradient(135deg, #0f766e, #14b8a6, #2dd4bf, #0284c7, #0f766e)', // Aqua Marine
    'linear-gradient(135deg, #6b21a8, #9333ea, #c084fc, #e879f9, #6b21a8)', // Mystic Amethyst
    'linear-gradient(135deg, #15803d, #65a30d, #a3e635, #4ade80, #15803d)', // Toxic Lime
    'linear-gradient(135deg, #1e1b4b, #4a044e, #701a75, #1e1b4b)', // Midnight Plum
    'linear-gradient(135deg, #0284c7, #38bdf8, #bae6fd, #e0f2fe, #0284c7)', // Iceberg Frost
    'linear-gradient(135deg, #b91c1c, #ef4444, #f97316, #fbbf24, #b91c1c)', // Fiery Phoenix
    'linear-gradient(135deg, #fbcfe8, #fed7aa, #fef08a, #bbf7d0, #bae6fd, #fbcfe8)', // Pastel Rainbow
    'linear-gradient(135deg, #022c22, #042f2e, #082f49, #0f172a, #022c22)', // Abyssal Trench
    'linear-gradient(135deg, #881337, #be185d, #ec4899, #f43f5e, #881337)', // Ruby Rose
    'linear-gradient(135deg, #06b6d4, #10b981, #fbbf24, #f97316, #06b6d4)', // Tropical Breeze
    'linear-gradient(135deg, #18181b, #27272a, #3f3f46, #52525b, #18181b)', // Dark Titanium
    'linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6, #06b6d4, #ec4899)', // Vaporwave Sunrise
    'linear-gradient(135deg, #78350f, #9a3412, #c2410c, #ca8a04, #78350f)', // Autumn Forest
    'linear-gradient(135deg, #f472b6, #c084fc, #60a5fa, #38bdf8, #f472b6)', // Cotton Candy
    'linear-gradient(135deg, #172554, #1e40af, #2563eb, #3b82f6, #172554)', // Cobalt Midnight
    'linear-gradient(135deg, #064e3b, #059669, #10b981, #4ade80, #064e3b)', // Emerald Matrix
    'linear-gradient(135deg, #be123c, #fb7185, #f97316, #fde047, #be123c)', // Coral Radiance
    'linear-gradient(135deg, #312e81, #4c1d95, #6d28d9, #a78bfa, #312e81)', // Lavender Twilight
];

export const MOCK_FRIENDS: LiveUser[] = [
    {
        uid: 'mock-friend-1',
        username: 'feliks_z',
        color: ANIMATED_PROFILE_GRADIENTS[5], // Electric Ocean
        status: 'RUNNING',
        lastSolveTime: 5820,
        recentSolves: [
            { time: 5820, penalty: 'none', timestamp: Date.now() - 12000 },
            { time: 6140, penalty: 'none', timestamp: Date.now() - 45000 },
            { time: 5490, penalty: 'none', timestamp: Date.now() - 95000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-2',
        username: 'tymon_k',
        color: ANIMATED_PROFILE_GRADIENTS[1], // Northern Lights
        status: 'INSPECTION',
        lastSolveTime: 4980,
        recentSolves: [
            { time: 4980, penalty: 'none', timestamp: Date.now() - 25000 },
            { time: 5210, penalty: 'none', timestamp: Date.now() - 60000 },
            { time: 6020, penalty: '+2', timestamp: Date.now() - 110000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-3',
        username: 'max_park',
        color: ANIMATED_PROFILE_GRADIENTS[4], // Citrus Sunshine
        status: 'SOLVED',
        lastSolveTime: 3950,
        recentSolves: [
            { time: 3950, penalty: 'none', timestamp: Date.now() - 5000 },
            { time: 4890, penalty: 'none', timestamp: Date.now() - 38000 },
            { time: 4520, penalty: 'none', timestamp: Date.now() - 82000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-4',
        username: 'yiheng_w',
        color: ANIMATED_PROFILE_GRADIENTS[0], // Sunset Ember
        status: 'RUNNING',
        lastSolveTime: 4120,
        recentSolves: [
            { time: 4120, penalty: 'none', timestamp: Date.now() - 18000 },
            { time: 4350, penalty: 'none', timestamp: Date.now() - 52000 },
            { time: 4800, penalty: 'none', timestamp: Date.now() - 88000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-5',
        username: 'sean_v',
        color: ANIMATED_PROFILE_GRADIENTS[2], // Cosmic Lavender
        status: 'IDLE',
        lastSolveTime: 6740,
        recentSolves: [
            { time: 6740, penalty: 'none', timestamp: Date.now() - 40000 },
            { time: 7020, penalty: 'none', timestamp: Date.now() - 95000 },
            { time: 6510, penalty: 'none', timestamp: Date.now() - 140000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-6',
        username: 'luke_g',
        color: ANIMATED_PROFILE_GRADIENTS[3], // Neon Cyberpunk
        status: 'PRIMING',
        lastSolveTime: 5430,
        recentSolves: [
            { time: 5430, penalty: 'none', timestamp: Date.now() - 8000 },
            { time: 5890, penalty: 'none', timestamp: Date.now() - 42000 },
            { time: 6110, penalty: 'none', timestamp: Date.now() - 76000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-7',
        username: 'matty_h',
        color: ANIMATED_PROFILE_GRADIENTS[6], // Bioluminescent Lagoon
        status: 'SOLVED',
        lastSolveTime: 5880,
        recentSolves: [
            { time: 5880, penalty: 'none', timestamp: Date.now() - 15000 },
            { time: 6300, penalty: 'none', timestamp: Date.now() - 65000 },
            { time: 5920, penalty: 'none', timestamp: Date.now() - 120000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-8',
        username: 'rui_h',
        color: ANIMATED_PROFILE_GRADIENTS[10], // Mint Fresh
        status: 'INSPECTION',
        lastSolveTime: 6210,
        recentSolves: [
            { time: 6210, penalty: 'none', timestamp: Date.now() - 30000 },
            { time: 6850, penalty: 'none', timestamp: Date.now() - 75000 },
            { time: 6440, penalty: 'none', timestamp: Date.now() - 130000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-9',
        username: 'leo_b',
        color: ANIMATED_PROFILE_GRADIENTS[8], // Molten Magma
        status: 'RUNNING',
        lastSolveTime: 5120,
        recentSolves: [
            { time: 5120, penalty: 'none', timestamp: Date.now() - 10000 },
            { time: 5480, penalty: 'none', timestamp: Date.now() - 48000 },
            { time: 5670, penalty: 'none', timestamp: Date.now() - 92000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-10',
        username: 'alex_m',
        color: ANIMATED_PROFILE_GRADIENTS[9], // Royal Velvet
        status: 'IDLE',
        lastSolveTime: 7420,
        recentSolves: [
            { time: 7420, penalty: 'none', timestamp: Date.now() - 55000 },
            { time: 7890, penalty: 'none', timestamp: Date.now() - 105000 },
            { time: 7210, penalty: 'none', timestamp: Date.now() - 160000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-11',
        username: 'brian_j',
        color: ANIMATED_PROFILE_GRADIENTS[14], // Aqua Marine
        status: 'SOLVED',
        lastSolveTime: 8150,
        recentSolves: [
            { time: 8150, penalty: 'none', timestamp: Date.now() - 20000 },
            { time: 8640, penalty: 'none', timestamp: Date.now() - 70000 },
            { time: 7920, penalty: 'none', timestamp: Date.now() - 115000 },
        ],
        timestamp: Date.now()
    },
    {
        uid: 'mock-friend-12',
        username: 'charlie_k',
        color: ANIMATED_PROFILE_GRADIENTS[7], // Cherry Blossom
        status: 'IDLE',
        lastSolveTime: 6950,
        recentSolves: [
            { time: 6950, penalty: 'none', timestamp: Date.now() - 35000 },
            { time: 7320, penalty: 'none', timestamp: Date.now() - 85000 },
            { time: 6810, penalty: 'none', timestamp: Date.now() - 145000 },
        ],
        timestamp: Date.now()
    }
];

const COMMUNITY_USERNAMES = [
    'speedcuber99', 'rubiks_pro', 'cfop_master', 'sub10_dreamer', 'fmc_wizard',
    'blind_solver', 'algorithm_ace', 'pll_time', 'oll_expert', 'cross_first',
    'corner_twist', 'megaminx_fan', 'pyra_king', 'skewb_god', 'sq1_drifter',
    'cube_whisperer', 'clock_lord', 'f2l_flow', 'turner_3000', 'vscube',
    'cubing_ninja', 'nexus_cuber', 'valk_elite', 'gan_speed', 'moyu_beast',
    'qiyi_warrior', 'dayan_nostalgia', 'tornado_v3', 'wrm_v9', 'halo_timer',
    'csTimer_refugee', 'alg_trainer', 'roux_rebel', 'zz_method_enjoyer', 'bld_3x3',
    'finger_tricks', 'inspect_15', 't_perm_lover', 'y_perm_god', 'j_perm_fan',
    'u_perm_master', 'h_perm_king', 'z_perm_pro', 'e_perm_hater', 'f_perm_ace',
    'v_perm_expert', 'n_perm_slayer', 'g_perm_grind', 'pll_skip_lucky', 'sub5_hopeful'
];

const COMMUNITY_STATUSES = ['IDLE', 'RUNNING', 'INSPECTION', 'SOLVED', 'PRIMING'] as const;

export const MOCK_COMMUNITY_USERS: LiveUser[] = COMMUNITY_USERNAMES.map((username, index) => ({
    uid: `mock-community-${index + 1}`,
    username,
    color: ANIMATED_PROFILE_GRADIENTS[index % ANIMATED_PROFILE_GRADIENTS.length],
    status: COMMUNITY_STATUSES[index % COMMUNITY_STATUSES.length],
    lastSolveTime: 7000 + (index * 190) % 8000,
    timestamp: Date.now()
}));
