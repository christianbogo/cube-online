import type { StateCreator } from 'zustand';
import type { TournamentStore } from '../tournamentStore';
import type { Player, TeamId, PlayerRole, BotConfig } from '@/types/tournament';
import { DEFAULT_PLAYER_COLORS } from '@/types/tournament';
import { AVAILABLE_COLORS } from '@/utils/arenaHelpers';

const getInitialHostName = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('cubeonline_account_nickname') || 'HOST';
  }
  return 'HOST';
};

const DEFAULT_PLAYERS: Player[] = [
  {
    id: 'p1',
    name: getInitialHostName(),
    role: 'HOST',
    key: ' ',
    color: DEFAULT_PLAYER_COLORS[0].color,
    accentColor: DEFAULT_PLAYER_COLORS[0].accentColor,
    active: true,
    team: 'RED',
  },
];

export interface PlayerSlice {
  players: Player[];
  localPlayerId: string | null;
  setLocalPlayerId: (id: string | null) => void;
  setPlayerTeam: (playerId: string, team: TeamId) => void;
  setPlayerRole: (playerId: string, role: PlayerRole) => void;
  updatePlayerBotConfig: (playerId: string, config: Partial<BotConfig>) => void;
  addPlayer: (name: string, team?: TeamId, role?: PlayerRole, botConfig?: BotConfig, id?: string, color?: string) => void;
  removePlayer: (id: string) => void;
  updatePlayerName: (id: string, name: string) => void;
  updatePlayerTimeNerf: (id: string, nerfMs: number) => void;
  updatePlayerColor: (id: string, color: string, accentColor: string) => void;
  togglePlayerActive: (id: string) => void;
  reorderPlayers: (startIndex: number, endIndex: number) => void;
}

export const createPlayerSlice: StateCreator<TournamentStore, [['zustand/immer', never]], [], PlayerSlice> = (set) => ({
  players: DEFAULT_PLAYERS,
  localPlayerId: null,
  setLocalPlayerId: (id) => set((state) => { state.localPlayerId = id; }),
  setPlayerTeam: (playerId, team) => {
    set((state) => {
      const p = state.players.find((p) => p.id === playerId);
      if (p) p.team = team;
    });
  },
  setPlayerRole: (playerId, role) => {
    set((state) => {
      const p = state.players.find((p) => p.id === playerId);
      if (!p) return;
      
      const defaultBotConfig: BotConfig = p.botConfig || {
        averageTimeMs: 20000,
        stdDevMs: 1000,
        maturity: 'INTERMEDIATE',
      };
      
      p.role = role;
      if (role === 'BOT') {
        p.botConfig = defaultBotConfig;
      } else {
        p.botConfig = undefined;
      }

      if (role === 'HOST') {
        const otherHost = state.players.find((other) => other.role === 'HOST' && other.id !== playerId);
        if (otherHost) {
          otherHost.role = 'BOT';
          otherHost.botConfig = { averageTimeMs: 5200, stdDevMs: 600, maturity: 'INTERMEDIATE' };
        }
      }
    });
  },
  updatePlayerBotConfig: (playerId, config) => {
    set((state) => {
      const p = state.players.find((p) => p.id === playerId);
      if (!p) return;
      if (!p.botConfig) {
        p.botConfig = { averageTimeMs: 5000, stdDevMs: 600, maturity: 'INTERMEDIATE' };
      }
      Object.assign(p.botConfig, config);
    });
  },
  addPlayer: (name, team = 'RED', role = 'BOT', botConfig, id, color) => {
    set((state) => {
      if (state.players.length >= 10) return;

      const nextIndex = state.players.length;
      const colorTheme = DEFAULT_PLAYER_COLORS[nextIndex % DEFAULT_PLAYER_COLORS.length];
      const newId = id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const defaultBotConfig: BotConfig = botConfig || {
        averageTimeMs: 15000,
        stdDevMs: 1000,
        maturity: 'INTERMEDIATE',
      };

      const isBot = role === 'BOT';
      const randomColor = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)].hex;
      const assignedColor = color || (isBot ? randomColor : colorTheme.color);

      state.players.push({
        id: newId,
        name: isBot ? name.slice(0, 20) : name.toUpperCase().slice(0, 20),
        role,
        key: role === 'HOST' ? ' ' : `bot-${nextIndex + 1}`,
        color: assignedColor,
        accentColor: assignedColor,
        active: true,
        team,
        botConfig: isBot ? defaultBotConfig : undefined,
      });
    });
  },
  removePlayer: (id) => {
    set((state) => {
      if (state.players.length <= 1) return;
      state.players = state.players.filter((p) => p.id !== id);
    });
  },
  updatePlayerName: (id, name) => {
    set((state) => {
      const p = state.players.find((p) => p.id === id);
      if (p) p.name = p.role === 'BOT' ? name.slice(0, 20) : name.toUpperCase().slice(0, 20);
    });
  },
  updatePlayerTimeNerf: (id, nerfMs) => {
    set((state) => {
      const p = state.players.find((p) => p.id === id);
      if (p) p.timeNerfMs = nerfMs;
    });
  },
  updatePlayerColor: (id, color, accentColor) => {
    set((state) => {
      const p = state.players.find((p) => p.id === id);
      if (p) {
        p.color = color;
        p.accentColor = accentColor;
      }
    });
  },
  togglePlayerActive: (id) => {
    set((state) => {
      const p = state.players.find((p) => p.id === id);
      if (p) p.active = !p.active;
    });
  },
  reorderPlayers: (startIndex, endIndex) => {
    set((state) => {
      const [removed] = state.players.splice(startIndex, 1);
      state.players.splice(endIndex, 0, removed);
    });
  },
});
