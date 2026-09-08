import { useEffect, useRef } from 'react';
import { useTimerStore } from '@/store/timerStore';
import { useTournamentStore } from '@/store/tournamentStore';
import { generateBotSolve, generateBotReadyDelay } from '@/utils/botSimulator';
import type { SimulatedBotSolve } from '@/utils/botSimulator';
import { soundEngine } from '@/audio/soundEffects';
import { formatTime } from '@/utils/formatters';
import type { PenaltyType } from '@/types/tournament';

/**
 * Intelligent Hook managing all Bot AI opponents:
 * 1. Bots ready up after a random delay (< 3s) once the Host starts holding Spacebar.
 * 2. Bots reset their holds if the Host lets go before lock-in.
 * 3. Bots launch or false start on countdown based on their maturity.
 * 4. Bots simulate their solve times with normal distribution, render live running time, and stop upon completion.
 */
export function useBotController() {
  const players = useTournamentStore((s) => s.players);
  const settings = useTournamentStore((s) => s.settings);
  const raceState = useTimerStore((s) => s.raceState);
  const handleKeyDown = useTimerStore((s) => s.handleKeyDown);
  const handleKeyUp = useTimerStore((s) => s.handleKeyUp);
  const stopPlayer = useTimerStore((s) => s.stopPlayer);

  const activeBots = players.filter((p) => p.active && p.role === 'BOT');
  const hostPlayer = players.find((p) => p.active && p.role === 'HOST');

  const readyTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const solveTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const botSimulatedSolvesRef = useRef<Record<string, SimulatedBotSolve>>({});

  const activeBotsRef = useRef(activeBots);
  const hostPlayerRef = useRef(hostPlayer);
  const settingsRef = useRef(settings);

  useEffect(() => {
    activeBotsRef.current = activeBots;
    hostPlayerRef.current = hostPlayer;
    settingsRef.current = settings;
  });

  // 1. Bot Ready-Up Behavior (Triggered when Host holds Spacebar in WAITING_FOR_ALL / IDLE)
  useEffect(() => {
    if (!hostPlayer) return;
    const timerPlayers = useTimerStore.getState().players;
    const hostTimer = timerPlayers[hostPlayer.id];
    const isHostHolding = hostTimer?.isHeld;

    if ((raceState === 'WAITING_FOR_ALL' || raceState === 'IDLE') && isHostHolding) {
      // Host is holding! Schedule each bot to ready up within a random human-like delay (< 3s)
      activeBots.forEach((bot) => {
        const botTimer = timerPlayers[bot.id];
        if (!botTimer?.isHeld && !readyTimeoutsRef.current[bot.id]) {
          const delay = generateBotReadyDelay();
          readyTimeoutsRef.current[bot.id] = setTimeout(() => {
            const currentHostTimer = useTimerStore.getState().players[hostPlayer.id];
            const currentRaceState = useTimerStore.getState().raceState;
            // Only hold if host is still holding and state allows
            if (
              currentHostTimer?.isHeld &&
              (currentRaceState === 'WAITING_FOR_ALL' || currentRaceState === 'IDLE')
            ) {
              handleKeyDown(bot.id, Date.now());
            }
            delete readyTimeoutsRef.current[bot.id];
          }, delay);
        }
      });
    } else if (!isHostHolding && (raceState === 'WAITING_FOR_ALL' || raceState === 'IDLE')) {
      // Host let go before lock-in: cancel all bot ready-up timeouts and release bot holds
      Object.values(readyTimeoutsRef.current).forEach(clearTimeout);
      readyTimeoutsRef.current = {};

      activeBots.forEach((bot) => {
        const botTimer = useTimerStore.getState().players[bot.id];
        if (botTimer?.isHeld) {
          handleKeyUp(bot.id, Date.now());
        }
      });
    }
  }, [hostPlayer, raceState, activeBots, handleKeyDown, handleKeyUp]);

  // 2. Pre-generate bot solve stats when lock-in / countdown begins
  useEffect(() => {
    if (raceState === 'LOCKED_IN' || raceState === 'DRAG_COUNTDOWN') {
      const solvesMap: Record<string, SimulatedBotSolve> = {};
      activeBotsRef.current.forEach((bot) => {
        const config = bot.botConfig || {
          averageTimeMs: 5000,
          stdDevMs: 600,
          maturity: 'INTERMEDIATE',
        };
        solvesMap[bot.id] = generateBotSolve(config as any);
      });
      botSimulatedSolvesRef.current = solvesMap;
    }
  }, [raceState]);

  // 3. Early False Start check during DRAG_COUNTDOWN
  useEffect(() => {
    if (raceState !== 'DRAG_COUNTDOWN') return;

    const scheduledGreen = useTimerStore.getState().scheduledGreenTime;
    if (!scheduledGreen) return;

    activeBotsRef.current.forEach((bot) => {
      const sim = botSimulatedSolvesRef.current[bot.id];
      if (sim && sim.falseStartDeltaMs > 0) {
        // Schedule bot to release early before green
        const earlyReleaseTime = scheduledGreen - sim.falseStartDeltaMs;
        const delayUntilEarlyRelease = Math.max(50, earlyReleaseTime - Date.now());

        const earlyTimeout = setTimeout(() => {
          if (useTimerStore.getState().raceState === 'DRAG_COUNTDOWN') {
            const res = handleKeyUp(bot.id, Date.now());
            if (res.isFalseStart) {
              soundEngine.playFalseStart();
            }
          }
        }, delayUntilEarlyRelease);

        readyTimeoutsRef.current[`early_${bot.id}`] = earlyTimeout;
      }
    });

    return () => {
      Object.keys(readyTimeoutsRef.current)
        .filter((k) => k.startsWith('early_'))
        .forEach((k) => {
          clearTimeout(readyTimeoutsRef.current[k]);
          delete readyTimeoutsRef.current[k];
        });
    };
  }, [raceState, handleKeyUp]);

  // 4. Live Solve Simulation during RACING state (Fires once when RACING begins)
  useEffect(() => {
    if (raceState !== 'RACING') {
      // Clear any pending solve timeouts
      Object.values(solveTimeoutsRef.current).forEach(clearTimeout);
      solveTimeoutsRef.current = {};
      return;
    }

    const raceStart = useTimerStore.getState().raceStartTime || Date.now();
    const currentTimerPlayers = useTimerStore.getState().players;

    activeBotsRef.current.forEach((bot) => {
      const botTimer = currentTimerPlayers[bot.id];
      if (botTimer?.isRunning && !botTimer?.isFinished) {
        let sim = botSimulatedSolvesRef.current[bot.id];
        if (!sim) {
          const config = bot.botConfig || {
            averageTimeMs: 5000,
            stdDevMs: 600,
            maturity: 'INTERMEDIATE',
          };
          sim = generateBotSolve(config as any);
          botSimulatedSolvesRef.current[bot.id] = sim;
        }

        const finishTimestamp = raceStart + sim.targetSolveTimeMs;
        const delayUntilFinish = Math.max(100, finishTimestamp - Date.now());

        solveTimeoutsRef.current[bot.id] = setTimeout(() => {
          const currentRaceState = useTimerStore.getState().raceState;
          const currentBotTimer = useTimerStore.getState().players[bot.id];

          if (currentRaceState === 'RACING' && currentBotTimer?.isRunning && !currentBotTimer.isFinished) {
            const rank = stopPlayer(bot.id, finishTimestamp, sim.penalty as PenaltyType);
            if (rank > 0) {
              soundEngine.playFinishChime(rank);
              const tp = useTimerStore.getState().players[bot.id];
              const tState = useTournamentStore.getState();
              const currentGame = tState.sets[tState.currentSetIndex]?.games[tState.currentGameIndex];

              const isPlus2 = sim.penalty === 'PLUS_2';
              const isDNF = sim.penalty === 'DNF';
              const rawMs = tp?.finishTimeMs || sim.targetSolveTimeMs;
              const fsDelta = (tp?.falseStartDeltaMs || 0) * settingsRef.current.falseStartMultiplier;
              const effectiveMs = isDNF ? 0 : rawMs + fsDelta + (isPlus2 ? 2000 : 0);
              const timeFormatted = formatTime(effectiveMs, { penalty: sim.penalty as PenaltyType });
              const timeSuffix = !isDNF && effectiveMs < 60000 ? 's' : '';

              // Live logging to activity feed
              tState.addActivityItem({
                type: 'SOLVE_FINISHED',
                playerId: bot.id,
                playerName: bot.name,
                playerColor: bot.color,
                team: bot.team,
                timeMs: effectiveMs,
                penalty: sim.penalty as PenaltyType,
                rank,
                gameId: currentGame?.id,
                roundIndex: tState.currentRoundIndex,
                message: `${bot.name} finished in ${timeFormatted}${timeSuffix} (#${rank})`,
              });

              if ((tp?.falseStartDeltaMs || 0) > 0) {
                tState.addActivityItem({
                  type: 'FALSE_START',
                  playerId: bot.id,
                  playerName: bot.name,
                  playerColor: bot.color,
                  team: bot.team,
                  message: `⚠️ ${bot.name} early release (+${(
                    ((tp?.falseStartDeltaMs || 0) * tState.settings.falseStartMultiplier) /
                    1000
                  ).toFixed(2)}s)`,
                });
              }
            }
          }
        }, delayUntilFinish);
      }
    });

    return () => {
      Object.values(solveTimeoutsRef.current).forEach(clearTimeout);
      solveTimeoutsRef.current = {};
    };
  }, [raceState, stopPlayer]);
}
