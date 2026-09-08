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

// ---------------------------------------------------------------------------
// Serialisable snapshot written by the Host to Firebase
// ---------------------------------------------------------------------------
export interface FullStateSnapshot {
  matchStatus: string;
  raceState: string;
  scheduledGreenTime: number | null;
  raceStartTime: number | null;
  countdownStage: number;
  currentScramble: string;
  currentSetIndex: number;
  currentGameIndex: number;
  currentRoundIndex: number;
  players: TournamentStore['players'];
  settings: TournamentStore['settings'];
  timerPlayers: Record<string, PlayerTimerData>;
  currentGamePoints: Record<string, number>;
  lastRoundScores: Record<string, number>;
  lastMatchPlaces?: TournamentStore['lastMatchPlaces'];
  totalPoints: Record<string, number>;
  setWins: Record<string, number>;
  gameWins: Record<string, number>;
  teamGamePoints: TournamentStore['teamGamePoints'];
  teamTotalPoints: TournamentStore['teamTotalPoints'];
  teamSetWins: TournamentStore['teamSetWins'];
  teamGameWins: TournamentStore['teamGameWins'];
  activityFeed: TournamentStore['activityFeed'];
  matchBestTimeMs: number | null;
  setBestTimeMs: number | null;
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
    matchStatus: ts.matchStatus,
    raceState: timer.raceState,
    scheduledGreenTime: timer.scheduledGreenTime,
    raceStartTime: timer.raceStartTime,
    countdownStage: timer.countdownStage,
    currentScramble: ts.currentScramble,
    currentSetIndex: ts.currentSetIndex,
    currentGameIndex: ts.currentGameIndex,
    currentRoundIndex: ts.currentRoundIndex,
    players: ts.players,
    settings: ts.settings,
    timerPlayers: timer.players,
    currentGamePoints: ts.currentGamePoints,
    lastRoundScores: ts.lastRoundScores,
    lastMatchPlaces: ts.lastMatchPlaces || [],
    totalPoints: ts.totalPoints,
    setWins: ts.setWins,
    gameWins: ts.gameWins,
    teamGamePoints: ts.teamGamePoints,
    teamTotalPoints: ts.teamTotalPoints,
    teamSetWins: ts.teamSetWins,
    teamGameWins: ts.teamGameWins,
    activityFeed: ts.activityFeed,
    matchBestTimeMs: ts.matchBestTimeMs,
    setBestTimeMs: ts.setBestTimeMs,
    matchWinnerPlayerId: ts.matchWinnerPlayerId,
    matchWinnerTeamId: ts.matchWinnerTeamId,
    lastUpdate: Date.now(),
  };
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
      const snap = buildSnapshot();
      set(stateRef, snap).catch(console.error);
    }, 100);
  }, [stateRef]);

  // Subscribe to both stores and push on change
  useEffect(() => {
    const unsubTimer = useTimerStore.subscribe(pushState);
    const unsubTournament = useTournamentStore.subscribe(pushState);
    // Initial push
    pushState();
    return () => {
      unsubTimer();
      unsubTournament();
      if (throttleRef.current) clearTimeout(throttleRef.current);
    };
  }, [pushState]);

  // Listen for guest held states
  useEffect(() => {
    const unsub = onValue(heldRef, (snap) => {
      const data = snap.val() as Record<string, boolean> | null;
      if (!data) return;
      const timer = useTimerStore.getState();
      Object.entries(data).forEach(([slotId, isHeld]) => {
        const player = timer.players[slotId];
        if (!player) return;
        if (isHeld && !player.isHeld) {
          timer.handleKeyDown(slotId, Date.now());
        } else if (!isHeld && player.isHeld) {
          timer.handleKeyUp(slotId, Date.now());
        }
      });
    });
    return () => off(heldRef, 'value', unsub);
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
    return () => off(solvesRef, 'value', unsub);
  }, [solvesRef]);

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

  // Listen to host's full state and hydrate local stores
  useEffect(() => {
    const unsub = onValue(stateRef, (snap) => {
      const data = snap.val() as FullStateSnapshot | null;
      if (!data || data.lastUpdate <= lastAppliedRef.current) return;
      lastAppliedRef.current = data.lastUpdate;

      // Hydrate timer store
      useTimerStore.setState({
        raceState: data.raceState as ReturnType<typeof useTimerStore.getState>['raceState'],
        raceStartTime: data.raceStartTime,
        scheduledGreenTime: data.scheduledGreenTime,
        countdownStage: data.countdownStage,
        players: data.timerPlayers || {},
      });

      // Hydrate tournament store (partial — only the display-relevant fields)
      useTournamentStore.setState({
        matchStatus: data.matchStatus as ReturnType<typeof useTournamentStore.getState>['matchStatus'],
        currentScramble: data.currentScramble,
        currentSetIndex: data.currentSetIndex,
        currentGameIndex: data.currentGameIndex,
        currentRoundIndex: data.currentRoundIndex,
        currentGamePoints: data.currentGamePoints,
        lastRoundScores: data.lastRoundScores,
        lastMatchPlaces: data.lastMatchPlaces || [],
        totalPoints: data.totalPoints,
        setWins: data.setWins,
        gameWins: data.gameWins,
        teamGamePoints: data.teamGamePoints,
        teamTotalPoints: data.teamTotalPoints,
        teamSetWins: data.teamSetWins,
        teamGameWins: data.teamGameWins,
        activityFeed: data.activityFeed || [],
        matchBestTimeMs: data.matchBestTimeMs,
        setBestTimeMs: data.setBestTimeMs,
        matchWinnerPlayerId: data.matchWinnerPlayerId,
        matchWinnerTeamId: data.matchWinnerTeamId as ReturnType<typeof useTournamentStore.getState>['matchWinnerTeamId'],
        players: data.players,
        settings: data.settings,
      });
    });
    return () => off(stateRef, 'value', unsub);
  }, [stateRef]);

  // Monitor host heartbeat
  useEffect(() => {
    const hostHB = heartbeatRef;
    const unsub = onValue(hostHB, (snap) => {
      const ts = snap.val();
      if (typeof ts === 'number' && Date.now() - ts > 15000) {
        console.warn('Host appears dead');
      }
    });
    return () => off(hostHB, 'value', unsub);
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

  // Push held state
  const setHeld = useCallback(
    (held: boolean) => {
      set(heldSlotRef, held).catch(console.error);
    },
    [heldSlotRef]
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

  return {
    isHost: false,
    slotId,
    setHeld,
    pushSolve,
  };
}
