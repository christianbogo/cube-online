import { create } from 'zustand';
import type { RaceState, PenaltyType } from '@/types/tournament';

export interface PlayerTimerData {
  playerId: string;
  rawTimeMs: number;
  falseStartDeltaMs: number;
  isHeld: boolean;
  heldSince: number | null;
  isLockedIn: boolean;
  isRunning: boolean;
  isFinished: boolean;
  penalty?: PenaltyType;
  finishTimeMs: number | null;
  finishRank: number | null;
  lastPenalty?: PenaltyType;
  lastFinishTimeMs: number | null;
  lastFinishRank: number | null;
  lastFalseStartDeltaMs: number;
}

interface TimerStoreState {
  raceState: RaceState;
  raceStartTime: number | null;
  countdownStartTime: number | null;
  scheduledGreenTime: number | null;
  countdownStage: number;
  players: Record<string, PlayerTimerData>;
  keyToPlayerId: Record<string, string>;

  setKeyMapping: (mapping: Record<string, string>) => void;
  initPlayers: (playerIds: string[]) => void;
  setRaceState: (state: RaceState) => void;
  setCountdownStage: (stage: number) => void;
  setScheduledGreenTime: (time: number | null) => void;
  handleKeyDown: (playerId: string, timestamp: number, onStartNextRound?: () => void) => void;
  handleKeyUp: (playerId: string, timestamp: number) => { isFalseStart: boolean; deltaMs: number };
  startRace: (greenLightTimestamp: number) => void;
  stopPlayer: (playerId: string, finishTimestamp: number, penalty?: PenaltyType) => number;

  resetForNewRace: () => void;
}

export const useTimerStore = create<TimerStoreState>((set, get) => ({
  raceState: 'IDLE',
  raceStartTime: null,
  countdownStartTime: null,
  scheduledGreenTime: null,
  countdownStage: 0,
  players: {},
  keyToPlayerId: {},

  setKeyMapping: (mapping) => set({ keyToPlayerId: mapping }),

  initPlayers: (playerIds) => {
    const existing = get().players;
    const players: Record<string, PlayerTimerData> = {};
    playerIds.forEach((id) => {
      players[id] = {
        playerId: id,
        rawTimeMs: 0,
        falseStartDeltaMs: 0,
        isHeld: false,
        heldSince: null,
        isLockedIn: false,
        isRunning: false,
        isFinished: false,
        penalty: undefined,
        finishTimeMs: null,
        finishRank: null,
        lastPenalty: undefined,
        lastFinishTimeMs: null,
        lastFinishRank: null,
        lastFalseStartDeltaMs: 0,
      };
    });
    set({ players, raceState: 'IDLE', raceStartTime: null, countdownStartTime: null, scheduledGreenTime: null, countdownStage: 0 });
  },

  setRaceState: (state) => set({ raceState: state }),

  setCountdownStage: (stage) => set({ countdownStage: stage }),

  setScheduledGreenTime: (time) => set({ scheduledGreenTime: time }),

  handleKeyDown: (playerId, timestamp, onStartNextRound) => {
    const { raceState, players } = get();
    const p = players[playerId];
    if (!p) return;

    if (raceState === 'RACING') {
      if (p.isRunning && !p.isFinished) {
        get().stopPlayer(playerId, timestamp);
      }
      return;
    }

    if (raceState === 'FINISHED') {
      if (onStartNextRound) {
        onStartNextRound();
      }

      const resetPlayers: Record<string, PlayerTimerData> = {};
      Object.keys(players).forEach((id) => {
        const cur = players[id];
        resetPlayers[id] = {
          ...cur,
          rawTimeMs: 0,
          falseStartDeltaMs: 0,
          isRunning: false,
          isFinished: false,
          isLockedIn: false,
          lastPenalty: cur.penalty,
          lastFinishTimeMs: cur.finishTimeMs,
          lastFinishRank: cur.finishRank,
          lastFalseStartDeltaMs: cur.falseStartDeltaMs,
          penalty: undefined,
          finishTimeMs: null,
          finishRank: null,
          isHeld: id === playerId,
          heldSince: id === playerId ? timestamp : null,
        };
      });

      set({
        players: resetPlayers,
        raceState: 'WAITING_FOR_ALL',
        raceStartTime: null,
        countdownStartTime: null,
        scheduledGreenTime: null,
        countdownStage: 0,
      });
      return;
    }

    if (raceState === 'IDLE' || raceState === 'WAITING_FOR_ALL') {
      const updatedPlayers = {
        ...players,
        [playerId]: {
          ...p,
          isHeld: true,
          heldSince: p.isHeld ? p.heldSince : timestamp,
        },
      };

      set({
        players: updatedPlayers,
        raceState: 'WAITING_FOR_ALL',
      });
    }
  },

  handleKeyUp: (playerId, timestamp) => {
    const { raceState, players, scheduledGreenTime, countdownStartTime } = get();
    const p = players[playerId];
    if (!p) return { isFalseStart: false, deltaMs: 0 };

    if (raceState === 'WAITING_FOR_ALL' || raceState === 'IDLE') {
      const updatedPlayers = {
        ...players,
        [playerId]: {
          ...p,
          isHeld: false,
          heldSince: null,
          isLockedIn: false,
        },
      };

      const anyStillHeld = Object.values(updatedPlayers).some((x) => x.isHeld);
      set({
        players: updatedPlayers,
        raceState: anyStillHeld ? 'WAITING_FOR_ALL' : 'IDLE',
      });
      return { isFalseStart: false, deltaMs: 0 };
    }

    if (raceState === 'LOCKED_IN' || raceState === 'DRAG_COUNTDOWN') {
      let earlyDeltaMs = 1500;
      if (scheduledGreenTime) {
        earlyDeltaMs = Math.max(50, Math.round(scheduledGreenTime - timestamp));
      } else if (countdownStartTime) {
        earlyDeltaMs = Math.max(50, Math.round(2000 - (timestamp - countdownStartTime)));
      }

      const updatedPlayers = {
        ...players,
        [playerId]: {
          ...p,
          isHeld: false,
          falseStartDeltaMs: earlyDeltaMs,
        },
      };
      set({ players: updatedPlayers });
      return { isFalseStart: true, deltaMs: earlyDeltaMs };
    }

    set({
      players: {
        ...players,
        [playerId]: {
          ...p,
          isHeld: false,
          heldSince: null,
        },
      },
    });
    return { isFalseStart: false, deltaMs: 0 };
  },

  startRace: (greenLightTimestamp) => {
    const { players } = get();
    const updatedPlayers: Record<string, PlayerTimerData> = {};

    Object.keys(players).forEach((id) => {
      updatedPlayers[id] = {
        ...players[id],
        isHeld: false,
        isRunning: true,
        isFinished: false,
        penalty: undefined,
        rawTimeMs: 0,
        finishTimeMs: null,
        finishRank: null,
      };
    });

    set({
      raceState: 'RACING',
      raceStartTime: greenLightTimestamp,
      countdownStage: 0,
      scheduledGreenTime: null,
      players: updatedPlayers,
    });
  },

  stopPlayer: (playerId, finishTimestamp, penalty?: PenaltyType) => {
    const { raceStartTime, players } = get();
    const p = players[playerId];
    if (!p || !p.isRunning || p.isFinished) return 0;

    const rawTimeMs = raceStartTime ? Math.max(10, Math.round(finishTimestamp - raceStartTime)) : 0;
    const finishedCount = Object.values(players).filter((x) => x.isFinished).length;
    const finishRank = finishedCount + 1;

    const updatedPlayers = {
      ...players,
      [playerId]: {
        ...p,
        isRunning: false,
        isFinished: true,
        penalty: penalty || 'NONE',
        finishTimeMs: rawTimeMs,
        rawTimeMs,
        finishRank,
      },
    };

    const allFinished = Object.values(updatedPlayers).every((x) => x.isFinished);

    set({
      players: updatedPlayers,
      raceState: allFinished ? 'FINISHED' : 'RACING',
    });

    return finishRank;
  },

  resetForNewRace: () => {
    const { players } = get();
    const resetPlayers: Record<string, PlayerTimerData> = {};
    Object.keys(players).forEach((id) => {
      resetPlayers[id] = {
        playerId: id,
        rawTimeMs: 0,
        falseStartDeltaMs: 0,
        isHeld: false,
        heldSince: null,
        isLockedIn: false,
        isRunning: false,
        isFinished: false,
        penalty: undefined,
        finishTimeMs: null,
        finishRank: null,
        lastPenalty: players[id]?.penalty,
        lastFinishTimeMs: players[id]?.finishTimeMs,
        lastFinishRank: players[id]?.finishRank,
        lastFalseStartDeltaMs: players[id]?.falseStartDeltaMs,
      };
    });

    set({
      raceState: 'IDLE',
      raceStartTime: null,
      countdownStartTime: null,
      scheduledGreenTime: null,
      countdownStage: 0,
      players: resetPlayers,
    });
  },
}));
