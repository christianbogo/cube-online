import type { LiveUser } from '../types';

// Set to true whenever you want to test the UI with mock users
export const USE_MOCK_USERS = false;

export const MOCK_FRIENDS: LiveUser[] = [
    {
        uid: 'mock-friend-1',
        username: 'feliks_z',
        color: '#3b82f6',
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
        color: '#10b981',
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
        color: '#f59e0b',
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
        color: '#ef4444',
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
        color: '#8b5cf6',
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
        color: '#ec4899',
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
        color: '#06b6d4',
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
        color: '#84cc16',
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
        color: '#f97316',
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
        color: '#6366f1',
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
        color: '#14b8a6',
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
        color: '#e11d48',
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

const COMMUNITY_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#e11d48', '#a855f7', '#38bdf8', '#4ade80'
];

const COMMUNITY_STATUSES = ['IDLE', 'RUNNING', 'INSPECTION', 'SOLVED', 'PRIMING'] as const;

export const MOCK_COMMUNITY_USERS: LiveUser[] = COMMUNITY_USERNAMES.map((username, index) => ({
    uid: `mock-community-${index + 1}`,
    username,
    color: COMMUNITY_COLORS[index % COMMUNITY_COLORS.length],
    status: COMMUNITY_STATUSES[index % COMMUNITY_STATUSES.length],
    lastSolveTime: 7000 + (index * 190) % 8000,
    timestamp: Date.now()
}));
