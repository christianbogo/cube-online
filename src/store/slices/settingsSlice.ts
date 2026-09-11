import type { StateCreator } from 'zustand';
import type { TournamentStore } from '../tournamentStore';
import type { TournamentSettings } from '@/types/tournament';

const DEFAULT_SETTINGS: TournamentSettings = {
  tournamentMode: 'FREE_FOR_ALL',
  scoringMode: 'RANK_BASED',
  targetSets: 1,
  targetGames: 1,
  rankPointsFloor: 15,
  falseStartMultiplier: 5,
  soundEnabled: true,
  scrambleEvent: '333',
  scrambleSize: 1.5,
};

export interface SettingsSlice {
  settings: TournamentSettings;
  setTournamentMode: (mode: 'FREE_FOR_ALL' | 'TEAMS') => void;
  updateSettings: (newSettings: Partial<TournamentSettings>) => void;
}

export const createSettingsSlice: StateCreator<TournamentStore, [['zustand/immer', never]], [], SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,
  setTournamentMode: (mode) => {
    set((state) => {
      state.settings.tournamentMode = mode;
    });
  },
  updateSettings: (newSettings) => {
    set((state) => {
      Object.assign(state.settings, newSettings);
    });
  },
});
