import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

import { createPlayerSlice } from './slices/playerSlice';
import type { PlayerSlice } from './slices/playerSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import type { SettingsSlice } from './slices/settingsSlice';
import { createActivityFeedSlice } from './slices/activityFeedSlice';
import type { ActivityFeedSlice } from './slices/activityFeedSlice';
import { createMatchSlice } from './slices/matchSlice';
import type { MatchSlice } from './slices/matchSlice';

export type TournamentStore = PlayerSlice & SettingsSlice & ActivityFeedSlice & MatchSlice;

export const useTournamentStore = create<TournamentStore>()(
  persist(
    immer((...a) => ({
      ...createPlayerSlice(...a),
      ...createSettingsSlice(...a),
      ...createActivityFeedSlice(...a),
      ...createMatchSlice(...a),
    })),
    {
      name: 'cubing-tournament-storage',
      partialize: (state) => ({
        players: state.players,
        settings: state.settings,
      }),
    }
  )
);
