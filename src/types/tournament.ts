export const TournamentMode = {
  FREE_FOR_ALL: 'FREE_FOR_ALL',
  TEAMS: 'TEAMS',
} as const;
export type TournamentMode = (typeof TournamentMode)[keyof typeof TournamentMode];

export const ScoringMode = {
  RANK_BASED: 'RANK_BASED',
} as const;
export type ScoringMode = (typeof ScoringMode)[keyof typeof ScoringMode];

export const PenaltyType = {
  NONE: 'NONE',
  PLUS_2: 'PLUS_2',
  DNF: 'DNF',
} as const;
export type PenaltyType = (typeof PenaltyType)[keyof typeof PenaltyType];

export const TeamId = {
  RED: 'RED',
  BLUE: 'BLUE',
} as const;
export type TeamId = (typeof TeamId)[keyof typeof TeamId];

export const MatchStatus = {
  SETUP: 'SETUP',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const RaceState = {
  IDLE: 'IDLE',
  WAITING_FOR_ALL: 'WAITING_FOR_ALL',
  LOCKED_IN: 'LOCKED_IN',
  DRAG_COUNTDOWN: 'DRAG_COUNTDOWN',
  RACING: 'RACING',
  FINISHED: 'FINISHED',
} as const;
export type RaceState = (typeof RaceState)[keyof typeof RaceState];

export const PlayerRole = {
  HOST: 'HOST',
  BOT: 'BOT',
  PLAYER: 'PLAYER',
} as const;
export type PlayerRole = (typeof PlayerRole)[keyof typeof PlayerRole];

export const BotMaturity = {
  NOVICE: 'NOVICE',
  INTERMEDIATE: 'INTERMEDIATE',
  PRO: 'PRO',
  WORLD_CLASS: 'WORLD_CLASS',
} as const;
export type BotMaturity = (typeof BotMaturity)[keyof typeof BotMaturity];

export const BotDifficultyType = {
  ARENA: 'ARENA',
  CUSTOM: 'CUSTOM',
} as const;
export type BotDifficultyType = (typeof BotDifficultyType)[keyof typeof BotDifficultyType];

export const ActivityType = {
  SOLVE_FINISHED: 'SOLVE_FINISHED',
  FALSE_START: 'FALSE_START',
  PENALTY_APPLIED: 'PENALTY_APPLIED',
  GAME_WON: 'GAME_WON',
  SET_WON: 'SET_WON',
  MATCH_WON: 'MATCH_WON',
  RECORD_BROKEN: 'RECORD_BROKEN',
  HIGHLIGHT_SET: 'HIGHLIGHT_SET',
  HIGHLIGHT_GAME: 'HIGHLIGHT_GAME',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const RecordType = {
  MATCH_RECORD: 'MATCH_RECORD',
  SET_RECORD: 'SET_RECORD',
  GAME_RECORD: 'GAME_RECORD',
} as const;
export type RecordType = (typeof RecordType)[keyof typeof RecordType];

export interface BotConfig {
  difficultyType?: BotDifficultyType;
  arenaTier?: string;
  maturityNumber?: number;
  averageTimeMs: number;
  stdDevMs: number;
  maturity: BotMaturity;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  key: string;
  color: string;
  accentColor: string;
  active: boolean;
  team?: TeamId;
  botConfig?: BotConfig;
  timeNerfMs?: number;
}

export interface Solve {
  id: string;
  playerId: string;
  gameId: string;
  roundIndex: number;
  rawTimeMs: number;
  penalty: PenaltyType;
  falseStartDeltaMs: number;
  finalTimeMs: number;
  score: number;
  rank?: number;
  isDNF: boolean;
  completedAt: number;
}

export interface MatchPlaceResult {
  playerId: string;
  name: string;
  color: string;
  team?: TeamId;
  rank: number;
  timeMs: number;
  penalty: PenaltyType;
  isDNF: boolean;
  score?: number;
  falseStartDeltaMs?: number;
}

export interface Round {
  id: string;
  roundIndex: number;
  scramble?: string;
  solves: Record<string, Solve>;
  completed: boolean;
  completedAt: number | null;
}

export interface Game {
  id: string;
  gameIndex: number;
  rounds: Round[];
  solves: Record<string, Solve>;
  scores: Record<string, number>;
  winnerId: string | null;
  winnerTeam?: TeamId | null;
  completed: boolean;
  completedAt: number | null;
}

export interface SetMatch {
  id: string;
  setIndex: number;
  games: Game[];
  winnerId: string | null;
  winnerTeam?: TeamId | null;
  completed: boolean;
  completedAt: number | null;
}

export interface TournamentSettings {
  tournamentMode: TournamentMode;
  scoringMode: ScoringMode;
  targetSets: number;
  targetGames: number;
  rankPointsFloor: number;
  falseStartMultiplier: number;
  soundEnabled: boolean;
  soundVolume?: number;
  scrambleEvent: string;
  lockInDurationMs?: number;
  scrambleSize?: number;
}

export interface ActivityFeedItem {
  id: string;
  type: ActivityType;
  playerId?: string;
  playerName?: string;
  playerColor?: string;
  team?: TeamId;
  timeMs?: number;
  penalty?: PenaltyType;
  rank?: number;
  gameId?: string;
  roundIndex?: number;
  recordType?: RecordType;
  message: string;
  timestamp: number;
}

export type FeedItemType = 'CHAT' | 'HIGHLIGHT_SET' | 'HIGHLIGHT_GAME' | 'HIGHLIGHT_MATCH' | 'GAME_WON' | 'SET_WON' | 'MATCH_WON';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  senderId?: string;
  senderName?: string;
  senderColor?: string;
  senderRole?: 'host' | 'player' | 'spectator';
  playerId?: string;
  playerName?: string;
  playerColor?: string;
  team?: TeamId;
  timeMs?: number;
  formattedTime?: string;
  roundIndex?: number;
  gameIndex?: number;
  setIndex?: number;
  message: string;
  timestamp: number;
  likes?: Record<string, boolean>;
}

export const DEFAULT_HOME_ROW_KEYS: string[] = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'];

export const DEFAULT_PLAYER_COLORS: { color: string; accentColor: string }[] = [
  { color: 'text-amber-500 dark:text-amber-400', accentColor: '#f59e0b' },
  { color: 'text-cyan-500 dark:text-cyan-400', accentColor: '#06b6d4' },
  { color: 'text-emerald-500 dark:text-emerald-400', accentColor: '#10b981' },
  { color: 'text-violet-500 dark:text-violet-400', accentColor: '#8b5cf6' },
  { color: 'text-rose-500 dark:text-rose-400', accentColor: '#f43f5e' },
  { color: 'text-blue-500 dark:text-blue-400', accentColor: '#3b82f6' },
  { color: 'text-orange-500 dark:text-orange-400', accentColor: '#f97316' },
  { color: 'text-teal-500 dark:text-teal-400', accentColor: '#14b8a6' },
];
