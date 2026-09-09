import { useEffect, useRef } from 'react';
import { useTimerStore } from '@/store/timerStore';
import { soundEngine } from '@/audio/soundEffects';

/**
 * Hook to manage sound effects when players finish during an Arena race:
 * 1. Players shouldn't hear sounds of people (or bots) finishing while they're solving.
 * 2. Once they finish, they should hear sounds of other people (and bots) finishing.
 * 3. The player always hears their own finish chime when they complete their solve.
 * 4. Spectators (or non-solving users) hear all finish chimes as they occur.
 */
export function useFinishSoundController(localPlayerId?: string) {
  const localPlayerIdRef = useRef(localPlayerId);
  useEffect(() => {
    localPlayerIdRef.current = localPlayerId;
  }, [localPlayerId]);

  useEffect(() => {
    const finishedPlayerIds = new Set<string>();

    // Seed with already-finished players on mount to prevent replaying historical solves
    const initialPlayers = useTimerStore.getState().players;
    Object.values(initialPlayers).forEach((p) => {
      if (p.isFinished) {
        finishedPlayerIds.add(p.playerId);
      }
    });

    const unsub = useTimerStore.subscribe((state) => {
      const { raceState, players } = state;
      const myId = localPlayerIdRef.current;

      // Reset tracked finishes when not in an active or completed race round
      if (raceState !== 'RACING' && raceState !== 'FINISHED') {
        finishedPlayerIds.clear();
        return;
      }

      // Check if the local player is actively in the middle of a solve
      const myTimer = myId ? players[myId] : null;
      const isLocalSolving = Boolean(myTimer && myTimer.isRunning && !myTimer.isFinished);

      Object.values(players).forEach((p) => {
        if (p.isFinished && p.finishRank != null && !finishedPlayerIds.has(p.playerId)) {
          finishedPlayerIds.add(p.playerId);

          const isSelf = Boolean(myId && p.playerId === myId);

          if (isSelf) {
            // Local player finished! Play their own finish chime.
            soundEngine.playFinishChime(p.finishRank);
          } else if (!isLocalSolving) {
            // Another player/bot finished, and local player is not solving (already finished or spectating)
            soundEngine.playFinishChime(p.finishRank);
          }
          // If !isSelf && isLocalSolving: Muted so player can focus on their solve!
        }
      });
    });

    return () => {
      unsub();
    };
  }, []);
}
