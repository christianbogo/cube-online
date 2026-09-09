import type { StateCreator } from 'zustand';
import type { TournamentStore } from '../tournamentStore';
import type { ActivityFeedItem } from '@/types/tournament';

export interface ActivityFeedSlice {
  isActivityFeedOpen: boolean;
  activityFeed: ActivityFeedItem[];
  toggleActivityFeed: (open?: boolean) => void;
  addActivityItem: (item: Omit<ActivityFeedItem, 'id' | 'timestamp'> & Partial<Pick<ActivityFeedItem, 'id' | 'timestamp'>>) => void;
  clearActivityFeed: () => void;
}

export const createActivityFeedSlice: StateCreator<TournamentStore, [['zustand/immer', never]], [], ActivityFeedSlice> = (set) => ({
  isActivityFeedOpen: true,
  activityFeed: [],
  toggleActivityFeed: (open) => {
    set((state) => {
      state.isActivityFeedOpen = open !== undefined ? open : !state.isActivityFeedOpen;
    });
  },
  addActivityItem: (item) => {
    set((state) => {
      const newItem: ActivityFeedItem = {
        id: item.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: item.timestamp || Date.now(),
        ...item,
      };
      
      // Prevent duplicate chat messages
      if (state.activityFeed.some(feedItem => feedItem.id === newItem.id)) {
        return;
      }
      
      state.activityFeed.unshift(newItem);
      if (state.activityFeed.length > 100) {
        state.activityFeed.pop();
      }
    });
  },
  clearActivityFeed: () => {
    set((state) => {
      state.activityFeed = [];
    });
  },
});
