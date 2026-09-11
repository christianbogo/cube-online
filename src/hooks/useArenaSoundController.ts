import { useEffect, useRef } from 'react';
import { useTimerStore } from '@/store/timerStore';
import { useTournamentStore, type TournamentStore } from '@/store/tournamentStore';
import { useSoundStore } from '@/store/soundStore';
import { soundEngine } from '@/audio/soundEffects';

/**
 * Helper to count total completed sets across team and individual scoring
 */
function getTotalSetWins(state: TournamentStore): number {
  const teamTotal = (state.teamSetWins?.RED || 0) + (state.teamSetWins?.BLUE || 0);
  const indTotal = Object.values(state.setWins || {}).reduce((sum, val) => sum + (val || 0), 0);
  return teamTotal + indTotal;
}

/**
 * Unified reactive sound controller for the Arena.
 * Runs identically for all participants (host, guests, spectators):
 * 1. Unlocks Web Audio API AudioContext on user interaction.
 * 2. Syncs sound settings (enabled & volume & mute toggle).
 * 3. Plays ready lock-in sound when raceState enters LOCKED_IN.
 * 4. Plays countdown yellow beeps at stages 1, 2, and 3.
 * 5. Plays go tone on green light launch (raceState enters RACING).
 * 6. Plays finish chimes according to player focus rules.
 * 7. Plays victory fanfare on set or match wins.
 */
export function useArenaSoundController(localPlayerId?: string) {
  const localPlayerIdRef = useRef(localPlayerId);
  useEffect(() => {
    localPlayerIdRef.current = localPlayerId;
  }, [localPlayerId]);

  // Unlock AudioContext on first user interaction so network/store triggered sounds can play
  useEffect(() => {
    const handleUserGesture = () => {
      soundEngine.unlockAudio();
    };
    window.addEventListener('pointerdown', handleUserGesture, { capture: true });
    window.addEventListener('keydown', handleUserGesture, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', handleUserGesture, { capture: true });
      window.removeEventListener('keydown', handleUserGesture, { capture: true });
    };
  }, []);

  // Synchronize sound settings across sound store and tournament store
  const isMuted = useSoundStore((s) => s.isMuted);
  const soundEnabled = useTournamentStore((s) => s.settings.soundEnabled);
  const soundVolume = useTournamentStore((s) => s.settings.soundVolume);

  useEffect(() => {
    soundEngine.setEnabled(!isMuted && soundEnabled);
    if (soundVolume !== undefined) {
      soundEngine.setVolume(soundVolume);
    }
  }, [isMuted, soundEnabled, soundVolume]);

  // Reactive listener for timerStore events (lock-in, countdown, green go, finish chimes)
  useEffect(() => {
    const initialTimer = useTimerStore.getState();
    const prevRaceStateRef = { current: initialTimer.raceState };
    const lastCountdownStageRef = { current: initialTimer.countdownStage || 0 };
    const finishedPlayerIds = new Set<string>();

    // Seed already-finished players on mount to prevent replaying historical solves
    Object.values(initialTimer.players).forEach((p) => {
      if (p.isFinished) {
        finishedPlayerIds.add(p.playerId);
      }
    });

    const unsubTimer = useTimerStore.subscribe((state) => {
      const { raceState, countdownStage, players } = state;
      const prevRaceState = prevRaceStateRef.current;
      const myId = localPlayerIdRef.current;

      // 1. Ready Lock-in Sound
      if (prevRaceState !== 'LOCKED_IN' && raceState === 'LOCKED_IN') {
        soundEngine.playLockIn();
      }

      // 2. Countdown Yellow Beeps (Stages 1, 2, 3)
      if (raceState === 'DRAG_COUNTDOWN') {
        if (countdownStage > lastCountdownStageRef.current && countdownStage >= 1 && countdownStage <= 3) {
          soundEngine.playCountdownBeep(countdownStage);
          lastCountdownStageRef.current = countdownStage;
        }
      } else {
        lastCountdownStageRef.current = 0;
      }

      // 3. Green Launch Go Tone
      if (prevRaceState !== 'RACING' && raceState === 'RACING') {
        soundEngine.playGoTone();
      }

      // 4. Finish Chimes
      if (raceState !== 'RACING' && raceState !== 'FINISHED') {
        finishedPlayerIds.clear();
      } else {
        const myTimer = myId ? players[myId] : null;
        const isLocalSolving = Boolean(myTimer && myTimer.isRunning && !myTimer.isFinished);

        Object.values(players).forEach((p) => {
          if (p.isFinished && p.finishRank != null && !finishedPlayerIds.has(p.playerId)) {
            finishedPlayerIds.add(p.playerId);

            const isSelf = Boolean(myId && p.playerId === myId);
            if (isSelf) {
              soundEngine.playFinishChime(p.finishRank);
            } else if (!isLocalSolving) {
              soundEngine.playFinishChime(p.finishRank);
            }
          }
        });
      }

      prevRaceStateRef.current = raceState;
    });

    return () => {
      unsubTimer();
    };
  }, []);

  // Reactive listener for tournamentStore events (Set and Match victory fanfare)
  useEffect(() => {
    const initialTournament = useTournamentStore.getState();
    let lastTotalSetWins = getTotalSetWins(initialTournament);
    let lastHadMatchWinner = Boolean(
      initialTournament.matchWinnerPlayerId || initialTournament.matchWinnerTeamId
    );

    const unsubTournament = useTournamentStore.subscribe((state) => {
      const totalSetWins = getTotalSetWins(state);
      const hasMatchWinner = Boolean(state.matchWinnerPlayerId || state.matchWinnerTeamId);

      const isNewSetWin = totalSetWins > lastTotalSetWins;
      const isNewMatchWin = hasMatchWinner && !lastHadMatchWinner;

      lastTotalSetWins = totalSetWins;
      lastHadMatchWinner = hasMatchWinner;

      if (isNewSetWin || isNewMatchWin) {
        soundEngine.playVictoryFanfare();
      }
    });

    return () => {
      unsubTournament();
    };
  }, []);
}
