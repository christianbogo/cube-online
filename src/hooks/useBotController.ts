import { useEffect, useRef } from 'react';
import { useTimerStore } from '@/store/timerStore';
import { useTournamentStore } from '@/store/tournamentStore';
import { generateBotSolve } from '@/utils/botSimulator';
import type { SimulatedBotSolve } from '@/utils/botSimulator';
import { formatTime } from '@/utils/formatters';
import type { PenaltyType } from '@/types/tournament';

/**
 * Intelligent Hook managing Bot AI opponents:
 * 1. Bots do not ready up and do not influence match countdown.
 * 2. Solve times are pre-generated on lock-in / countdown via Gaussian normal distribution from botConfig.
 * 3. During RACING, bot timers simulate live solving, stop upon completion, log to activity feed, and add times to match results.
 */
export function useBotController() {
  const players = useTournamentStore((s) => s.players);
  const settings = useTournamentStore((s) => s.settings);
  const raceState = useTimerStore((s) => s.raceState);
  const stopPlayer = useTimerStore((s) => s.stopPlayer);

  const activeBots = players.filter((p) => p.active && p.role === 'BOT');
  const solveTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const botSimulatedSolvesRef = useRef<Record<string, SimulatedBotSolve>>({});

  const activeBotsRef = useRef(activeBots);
  const settingsRef = useRef(settings);

  useEffect(() => {
    activeBotsRef.current = activeBots;
    settingsRef.current = settings;
  });

  // 1. Pre-generate bot solve stats when lock-in / countdown begins
  useEffect(() => {
    if (raceState === 'LOCKED_IN' || raceState === 'DRAG_COUNTDOWN') {
      const solvesMap: Record<string, SimulatedBotSolve> = {};
      activeBotsRef.current.forEach((bot) => {
        const config = bot.botConfig || {
          averageTimeMs: 15000,
          stdDevMs: 1000,
          maturity: 'INTERMEDIATE' as const,
        };
        solvesMap[bot.id] = generateBotSolve(config);
      });
      botSimulatedSolvesRef.current = solvesMap;
    }
  }, [raceState]);

  // 2. Live Solve Simulation during RACING state (Fires once when RACING begins)
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
            averageTimeMs: 15000,
            stdDevMs: 1000,
            maturity: 'INTERMEDIATE' as const,
          };
          sim = generateBotSolve(config);
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
