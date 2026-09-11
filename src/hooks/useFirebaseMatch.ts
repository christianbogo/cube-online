// src/hooks/useFirebaseMatch.ts
//
// Firebase Realtime Database synchronization hook for the Arena match system.
// The Host is authoritative: it writes a serialized snapshot of the tournament
// and timer stores to `rooms/${roomId}/fullState` on every significant change.
// Guests read that snapshot and push their local actions (held, solves) to
// dedicated per-slot paths.

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { ref, onValue, set, update, remove, onDisconnect, off } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { useTimerStore } from '@/store/timerStore';
import type { PlayerTimerData } from '@/store/timerStore';
import { useTournamentStore } from '@/store/tournamentStore';
import type { TournamentStore } from '@/store/tournamentStore';
import type { SetMatch } from '@/types/tournament';

export function normalizeSets(rawSets: any): SetMatch[] {
  if (!rawSets) return [];
  const setsArr: any[] = Array.isArray(rawSets) ? rawSets : Object.values(rawSets);
  return setsArr.filter(Boolean).map((s: any) => {
    const rawGames = s.games || [];
    const gamesArr: any[] = Array.isArray(rawGames) ? rawGames : Object.values(rawGames);
    const games = gamesArr.filter(Boolean).map((g: any) => {
      const rawRounds = g.rounds || [];
      const roundsArr: any[] = Array.isArray(rawRounds) ? rawRounds : Object.values(rawRounds);
      const rounds = roundsArr.filter(Boolean).map((r: any) => {
        return {
          ...r,
          solves: r.solves || {},
        };
      });
      return {
        ...g,
        rounds,
        solves: g.solves || {},
        scores: g.scores || {},
      };
    });
    return {
      ...s,
      games,
    };
  });
}

// ---------------------------------------------------------------------------
// Serialisable snapshot written by the Host to Firebase
// ---------------------------------------------------------------------------
export interface FullStateSnapshot {
  matchId: string;
  matchStatus: string;
  raceState: string;
  scheduledGreenTime: number | null;
  raceStartTime: number | null;
  countdownStage: number;
  currentScramble: string;
  isScrambleLoading: boolean;
  currentSetIndex: number;
  currentGameIndex: number;
  currentRoundIndex: number;
  players: TournamentStore['players'];
  settings: TournamentStore['settings'];
  timerPlayers: Record<string, PlayerTimerData>;
  currentGamePoints: Record<string, number>;
  currentGameSolves: TournamentStore['currentGameSolves'];
  lastRoundScores: Record<string, number>;
  lastMatchPlaces?: TournamentStore['lastMatchPlaces'];
  totalPoints: Record<string, number>;
  setWins: Record<string, number>;
  gameWins: Record<string, number>;
  teamGamePoints: TournamentStore['teamGamePoints'];
  teamTotalPoints: TournamentStore['teamTotalPoints'];
  teamSetWins: TournamentStore['teamSetWins'];
  teamGameWins: TournamentStore['teamGameWins'];
  sets: TournamentStore['sets'];
  activityFeed: TournamentStore['activityFeed'];
  matchBestTimeMs: number | null;
  setBestTimeMs: number | null;
  gameBestTimeMs: number | null;
  matchWinnerPlayerId: string | null;
  matchWinnerTeamId: string | null;
  lastUpdate: number;
}

// ---------------------------------------------------------------------------
// Build a snapshot from the current Zustand state
// ---------------------------------------------------------------------------
function buildSnapshot(): FullStateSnapshot {
  const ts = useTournamentStore.getState();
  const timer = useTimerStore.getState();
  return {
    matchId: ts.matchId,
    matchStatus: ts.matchStatus,
    raceState: timer.raceState,
    scheduledGreenTime: timer.scheduledGreenTime,
    raceStartTime: timer.raceStartTime,
    countdownStage: timer.countdownStage,
    currentScramble: ts.currentScramble,
    isScrambleLoading: ts.isScrambleLoading,
    currentSetIndex: ts.currentSetIndex,
    currentGameIndex: ts.currentGameIndex,
    currentRoundIndex: ts.currentRoundIndex,
    players: ts.players,
    settings: ts.settings,
    timerPlayers: timer.players,
    currentGamePoints: ts.currentGamePoints,
    currentGameSolves: ts.currentGameSolves,
    lastRoundScores: ts.lastRoundScores,
    lastMatchPlaces: ts.lastMatchPlaces || [],
    totalPoints: ts.totalPoints,
    setWins: ts.setWins,
    gameWins: ts.gameWins,
    teamGamePoints: ts.teamGamePoints,
    teamTotalPoints: ts.teamTotalPoints,
    teamSetWins: ts.teamSetWins,
    teamGameWins: ts.teamGameWins,
    sets: ts.sets,
    activityFeed: ts.activityFeed,
    matchBestTimeMs: ts.matchBestTimeMs,
    setBestTimeMs: ts.setBestTimeMs,
    gameBestTimeMs: ts.gameBestTimeMs,
    matchWinnerPlayerId: ts.matchWinnerPlayerId,
    matchWinnerTeamId: ts.matchWinnerTeamId,
    lastUpdate: Date.now(),
  };
}

function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => item === undefined ? null : stripUndefined(item));
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (obj[key] !== undefined) {
          res[key] = stripUndefined(obj[key]);
        }
      }
    }
    return res;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// HOST HOOK — authoritative client
// ---------------------------------------------------------------------------
export function useFirebaseHost(roomId: string) {
  const stateRef = useMemo(() => ref(rtdb, `rooms/${roomId}/fullState`), [roomId]);
  const heldRef = useMemo(() => ref(rtdb, `rooms/${roomId}/held`), [roomId]);
  const solvesRef = useMemo(() => ref(rtdb, `rooms/${roomId}/solves`), [roomId]);
  const heartbeatRef = useMemo(() => ref(rtdb, `rooms/${roomId}/hostHeartbeat`), [roomId]);

  // Push full state to Firebase, throttled to avoid rapid-fire writes
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushState = useCallback(() => {
    if (throttleRef.current) return; // Already scheduled
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
      try {
        const rawSnap = buildSnapshot();
        const snap = stripUndefined(rawSnap);
        console.log('[Host] Pushing state to ' + roomId + ':', snap);
        set(stateRef, snap)
          .then(() => console.log('[Host] Push success!'))
          .catch((err) => console.error('[Host] Push failed!', err));
      } catch (err) {
        console.error('[Host] buildSnapshot/stripUndefined crashed!', err);
      }
    }, 100);
  }, [stateRef, roomId]);

  // Subscribe to both stores and push on change
  useEffect(() => {
    const unsubTimer = useTimerStore.subscribe(pushState);
    const unsubTournament = useTournamentStore.subscribe(pushState);
    // Initial push
    pushState();
    return () => {
      unsubTimer();
      unsubTournament();
      if (throttleRef.current) { clearTimeout(throttleRef.current); throttleRef.current = null; }
    };
  }, [pushState]);



  // Listen for guest held states
  useEffect(() => {
    const unsub = onValue(heldRef, (snap) => {
      const data = snap.val() as Record<string, boolean> | null;
      const timer = useTimerStore.getState();

      // Process held entries from Firebase
      if (data) {
        Object.entries(data).forEach(([slotId, isHeld]) => {
          const player = timer.players[slotId];
          if (!player) return;
          if (isHeld && !player.isHeld) {
            timer.handleKeyDown(slotId, Date.now());
          } else if (!isHeld && player.isHeld) {
            timer.handleKeyUp(slotId, Date.now());
          }
        });
      }

      // Release any guest players whose held entry was removed (e.g. disconnect).
      // Skip the host player — their held state is managed by useKeyboardController.
      const hostPlayerId = useTournamentStore.getState().players.find(p => p.role === 'HOST')?.id;
      Object.entries(timer.players).forEach(([slotId, player]) => {
        if (slotId === hostPlayerId) return;
        if (player.isHeld && (!data || !(slotId in data))) {
          timer.handleKeyUp(slotId, Date.now());
        }
      });
    });
    return () => unsub();
  }, [heldRef]);

  // Listen for guest solve submissions
  useEffect(() => {
    const unsub = onValue(solvesRef, (snap) => {
      const data = snap.val() as Record<string, {
        rawTimeMs: number;
        penalty: string;
        falseStartDeltaMs: number;
        timestamp: number;
      }> | null;
      if (!data) return;
      const timer = useTimerStore.getState();
      Object.entries(data).forEach(([slotId, solve]) => {
        const player = timer.players[slotId];
        if (player && player.isRunning && !player.isFinished) {
          const finishTs = timer.raceStartTime
            ? timer.raceStartTime + solve.rawTimeMs
            : Date.now();
          timer.stopPlayer(slotId, finishTs);
        }
      });
      // Clear processed solves
      remove(solvesRef).catch(console.error);
    });
    return () => unsub();
  }, [solvesRef]);

  const penaltiesRef = useMemo(() => ref(rtdb, `rooms/${roomId}/penalties`), [roomId]);
  useEffect(() => {
    const unsub = onValue(penaltiesRef, (snap) => {
      const data = snap.val() as Record<string, { gameId: string, penalty: any, roundId?: string }> | null;
      if (!data) return;
      Object.entries(data).forEach(([slotId, p]) => {
        useTournamentStore.getState().applyPenalty(p.gameId, slotId, p.penalty, p.roundId);
      });
      remove(penaltiesRef).catch(console.error);
    });
    return () => unsub();
  }, [penaltiesRef]);

  // Host heartbeat
  useEffect(() => {
    const interval = setInterval(() => set(heartbeatRef, Date.now()), 5000);
    onDisconnect(heartbeatRef).remove();
    set(heartbeatRef, Date.now());
    return () => {
      clearInterval(interval);
      remove(heartbeatRef).catch(console.error);
    };
  }, [heartbeatRef]);

  return { isHost: true, pushState };
}

// ---------------------------------------------------------------------------
// GUEST HOOK — reads authoritative state, pushes local actions
// ---------------------------------------------------------------------------
export function useFirebaseGuest(roomId: string, slotId: string) {
  const stateRef = useMemo(() => ref(rtdb, `rooms/${roomId}/fullState`), [roomId]);
  const heldSlotRef = useMemo(() => ref(rtdb, `rooms/${roomId}/held/${slotId}`), [roomId, slotId]);
  const solveSlotRef = useMemo(() => ref(rtdb, `rooms/${roomId}/solves/${slotId}`), [roomId, slotId]);
  const heartbeatRef = useMemo(() => ref(rtdb, `rooms/${roomId}/hostHeartbeat`), [roomId]);
  const guestHBRef = useMemo(() => ref(rtdb, `rooms/${roomId}/guests/${slotId}/heartbeat`), [roomId, slotId]);

  const lastAppliedRef = useRef<number>(0);
  const localHeldRef = useRef<boolean | null>(null);

  // Listen to host's full state and hydrate local stores
  useEffect(() => {
    const unsub = onValue(stateRef, (snap) => {
      const data = snap.val() as FullStateSnapshot | null;
      console.log('[Guest] Received state snap for ' + roomId + ':', data);
      if (!data) {
        console.log('[Guest] Data is null. Skipping.');
        return;
      }
      if (data.lastUpdate <= lastAppliedRef.current) {
        console.log('[Guest] Data is stale (lastUpdate:', data.lastUpdate, '<=', lastAppliedRef.current, '). Skipping.');
        return;
      }
      lastAppliedRef.current = data.lastUpdate;
      console.log('[Guest] Applying state to Zustand stores...');

      let timerPlayersToSet = data.timerPlayers || {};
      const localHeld = localHeldRef.current;

      if (data.raceState === 'LOCKED_IN' || data.raceState === 'DRAG_COUNTDOWN' || data.raceState === 'RACING' || data.raceState === 'FINISHED') {
        localHeldRef.current = null;
      } else if (localHeld !== null) {
        const snapHeld = timerPlayersToSet[slotId]?.isHeld;
        if (snapHeld === localHeld) {
          localHeldRef.current = null;
        } else {
          timerPlayersToSet = {
            ...timerPlayersToSet,
            [slotId]: {
              ...(timerPlayersToSet[slotId] || {
                rawTimeMs: 0,
                falseStartDeltaMs: 0,
                isRunning: false,
                isFinished: false,
                isLockedIn: false,
                finishTimeMs: null,
                finishRank: null,
                penalty: undefined,
              }),
              isHeld: localHeld,
              heldSince: localHeld ? (timerPlayersToSet[slotId]?.heldSince || Date.now()) : null,
            },
          };
        }
      }

      // Hydrate timer store
      useTimerStore.setState({
        raceState: (data.raceState || 'IDLE') as ReturnType<typeof useTimerStore.getState>['raceState'],
        raceStartTime: data.raceStartTime ?? null,
        scheduledGreenTime: data.scheduledGreenTime ?? null,
        countdownStage: data.countdownStage || 0,
        players: timerPlayersToSet,
      });

      // Hydrate tournament store (partial — only the display-relevant fields)
      useTournamentStore.setState({
        matchId: data.matchId || '',
        matchStatus: (data.matchStatus || 'NOT_STARTED') as ReturnType<typeof useTournamentStore.getState>['matchStatus'],
        currentScramble: data.currentScramble || '',
        isScrambleLoading: data.isScrambleLoading ?? false,
        currentSetIndex: data.currentSetIndex || 0,
        currentGameIndex: data.currentGameIndex || 0,
        currentRoundIndex: data.currentRoundIndex || 0,
        currentGamePoints: data.currentGamePoints || {},
        currentGameSolves: data.currentGameSolves || {},
        lastRoundScores: data.lastRoundScores || {},
        lastMatchPlaces: data.lastMatchPlaces || [],
        totalPoints: data.totalPoints || {},
        setWins: data.setWins || {},
        gameWins: data.gameWins || {},
        teamGamePoints: data.teamGamePoints || {},
        teamTotalPoints: data.teamTotalPoints || {},
        teamSetWins: data.teamSetWins || {},
        teamGameWins: data.teamGameWins || {},
        sets: normalizeSets(data.sets),
        activityFeed: data.activityFeed || [],
        matchBestTimeMs: data.matchBestTimeMs ?? null,
        setBestTimeMs: data.setBestTimeMs ?? null,
        gameBestTimeMs: data.gameBestTimeMs ?? null,
        matchWinnerPlayerId: data.matchWinnerPlayerId ?? null,
        matchWinnerTeamId: (data.matchWinnerTeamId ?? null) as ReturnType<typeof useTournamentStore.getState>['matchWinnerTeamId'],
        players: data.players || [],
        settings: data.settings || useTournamentStore.getState().settings,
      });
      console.log('[Guest] State applied successfully.');
    });
    return () => unsub();
  }, [stateRef, roomId]);

  // Monitor host heartbeat
  useEffect(() => {
    const hostHB = heartbeatRef;
    const unsub = onValue(hostHB, (snap) => {
      const ts = snap.val();
      if (typeof ts === 'number' && Date.now() - ts > 15000) {
        console.warn('Host appears dead');
      }
    });
    return () => unsub();
  }, [heartbeatRef]);

  // Guest heartbeat
  useEffect(() => {
    const interval = setInterval(() => set(guestHBRef, Date.now()), 5000);
    onDisconnect(guestHBRef).remove();
    set(guestHBRef, Date.now());
    return () => {
      clearInterval(interval);
      remove(guestHBRef).catch(console.error);
    };
  }, [guestHBRef]);

  // Clean up held state on disconnect
  useEffect(() => {
    onDisconnect(heldSlotRef).remove();
    return () => {
      localHeldRef.current = null;
      remove(heldSlotRef).catch(console.error);
    };
  }, [heldSlotRef]);

  // Push held state with optimistic local update
  const setHeld = useCallback(
    (held: boolean) => {
      localHeldRef.current = held;
      useTimerStore.setState((state) => {
        const currentP = state.players[slotId] || {
          rawTimeMs: 0,
          falseStartDeltaMs: 0,
          isRunning: false,
          isFinished: false,
          isLockedIn: false,
          finishTimeMs: null,
          finishRank: null,
          penalty: undefined,
        };
        return {
          players: {
            ...state.players,
            [slotId]: {
              ...currentP,
              isHeld: held,
              heldSince: held ? (currentP.heldSince || Date.now()) : null,
            },
          },
        };
      });
      set(heldSlotRef, held).catch(console.error);
    },
    [heldSlotRef, slotId]
  );

  // Push solve result
  const pushSolve = useCallback(
    (rawTimeMs: number, penalty: string = 'NONE', falseStartDeltaMs: number = 0) => {
      set(solveSlotRef, {
        rawTimeMs,
        penalty,
        falseStartDeltaMs,
        timestamp: Date.now(),
      }).catch(console.error);
    },
    [solveSlotRef]
  );

  const penaltySlotRef = useMemo(() => ref(rtdb, `rooms/${roomId}/penalties/${slotId}`), [roomId, slotId]);
  const pushPenalty = useCallback(
    (gameId: string, penalty: any, roundId: string | undefined) => {
      set(penaltySlotRef, { gameId, penalty, roundId }).catch(console.error);
    },
    [penaltySlotRef]
  );

  return {
    isHost: false,
    slotId,
    setHeld,
    pushSolve,
    pushPenalty,
  };
}
