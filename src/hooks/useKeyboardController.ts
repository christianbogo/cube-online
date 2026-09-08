import { useEffect, useRef, useMemo } from 'react';
import { soundEngine } from '@/audio/soundEffects';
import { useTimerStore } from '@/store/timerStore';
import { useTournamentStore } from '@/store/tournamentStore';
import { useBotController } from '@/hooks/useBotController';
import { formatTime } from '@/utils/formatters';
import type { PenaltyType } from '@/types/tournament';

const LOCK_IN_DURATION_MS = 500;
const COUNTDOWN_STAGE_INTERVAL_MS = 400;

export function useKeyboardController() {
  const players = useTournamentStore((s) => s.players);
  const settings = useTournamentStore((s) => s.settings);
  const recordCompletedGame = useTournamentStore((s) => s.recordCompletedGame);
  const isAdminOpen = useTournamentStore((s) => s.isAdminOpen);

  const raceState = useTimerStore((s) => s.raceState);
  const timerPlayers = useTimerStore((s) => s.players);
  const initPlayers = useTimerStore((s) => s.initPlayers);
  const setRaceState = useTimerStore((s) => s.setRaceState);
  const setCountdownStage = useTimerStore((s) => s.setCountdownStage);
  const handleKeyDown = useTimerStore((s) => s.handleKeyDown);
  const handleKeyUp = useTimerStore((s) => s.handleKeyUp);
  const startRace = useTimerStore((s) => s.startRace);
  const stopPlayer = useTimerStore((s) => s.stopPlayer);

  // Activate Bot AI controller logic
  useBotController();

  const activePlayers = useMemo(() => players.filter((p) => p.active), [players]);
  const activePlayerIds = useMemo(() => activePlayers.map((p) => p.id), [activePlayers]);
  const activePlayerIdsKey = useMemo(() => activePlayerIds.join(','), [activePlayerIds]);

  const hostPlayer = useMemo(
    () => activePlayers.find((p) => p.role === 'HOST') || activePlayers[0],
    [activePlayers]
  );

  const settingsRef = useRef(settings);
  const activePlayersRef = useRef(activePlayers);
  const activePlayerIdsRef = useRef(activePlayerIds);
  const hostPlayerRef = useRef(hostPlayer);
  const isAdminOpenRef = useRef(isAdminOpen);

  useEffect(() => {
    settingsRef.current = settings;
    activePlayersRef.current = activePlayers;
    activePlayerIdsRef.current = activePlayerIds;
    hostPlayerRef.current = hostPlayer;
    isAdminOpenRef.current = isAdminOpen;
  });

  // Sync sound settings
  useEffect(() => {
    soundEngine.setEnabled(settings.soundEnabled);
    if (settings.soundVolume !== undefined) {
      soundEngine.setVolume(settings.soundVolume);
    }
  }, [settings.soundEnabled, settings.soundVolume]);

  // Initialize timer players when active players change
  useEffect(() => {
    initPlayers(activePlayerIds);
  }, [activePlayerIdsKey, initPlayers, activePlayerIds]);

  // Check whether all active players (Host + Bots) are currently holding
  const allHeld = useMemo(() => {
    return (
      activePlayerIds.length > 0 &&
      activePlayerIds.every((id) => timerPlayers[id]?.isHeld)
    );
  }, [timerPlayers, activePlayerIds]);

  // Lock-in timer ref
  const lockInTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for continuous hold across all active players
  useEffect(() => {
    if (isAdminOpenRef.current) return;
    if (raceState !== 'WAITING_FOR_ALL' && raceState !== 'IDLE') return;

    if (allHeld) {
      if (!lockInTimeoutRef.current) {
        lockInTimeoutRef.current = setTimeout(() => {
          const checkPlayers = useTimerStore.getState().players;
          const stillAllHeld = activePlayerIdsRef.current.every((id) => checkPlayers[id]?.isHeld);

          if (stillAllHeld) {
            const now = Date.now();
            const redPauseMs = 1000;
            const stageInterval = COUNTDOWN_STAGE_INTERVAL_MS;
            const randomPause = 600 + Math.random() * 1200;
            const targetGreen = now + redPauseMs + stageInterval * 2 + randomPause;

            useTimerStore.setState({
              scheduledGreenTime: targetGreen,
              countdownStartTime: now + redPauseMs,
            });

            setRaceState('LOCKED_IN');
            soundEngine.playLockIn();

            setTimeout(() => {
              setRaceState('DRAG_COUNTDOWN');
            }, redPauseMs);
          }
          lockInTimeoutRef.current = null;
        }, LOCK_IN_DURATION_MS);
      }
    } else {
      if (lockInTimeoutRef.current) {
        clearTimeout(lockInTimeoutRef.current);
        lockInTimeoutRef.current = null;
      }
    }

    return () => {
      if (lockInTimeoutRef.current) {
        clearTimeout(lockInTimeoutRef.current);
        lockInTimeoutRef.current = null;
      }
    };
  }, [allHeld, raceState, setRaceState]);

  // Dedicated Drag Race Countdown Runner through all yellow/orange stages
  useEffect(() => {
    if (raceState !== 'DRAG_COUNTDOWN') return;

    const startTime = Date.now();
    const stageInterval = COUNTDOWN_STAGE_INTERVAL_MS;
    const randomPauseAfterStage3 = 600 + Math.random() * 1200;
    const totalDurationBeforeGreen = stageInterval * 2 + randomPauseAfterStage3;
    const scheduledGreen = startTime + totalDurationBeforeGreen;

    useTimerStore.setState({
      countdownStartTime: startTime,
      scheduledGreenTime: scheduledGreen,
    });

    // Stage 1 Yellow (immediate)
    setCountdownStage(1);
    soundEngine.playCountdownBeep(1);

    // Stage 2 Yellow (at stageInterval)
    const timer2 = setTimeout(() => {
      setCountdownStage(2);
      soundEngine.playCountdownBeep(2);
    }, stageInterval);

    // Stage 3 Yellow (at stageInterval * 2)
    const timer3 = setTimeout(() => {
      setCountdownStage(3);
      soundEngine.playCountdownBeep(3);
    }, stageInterval * 2);

    // Green Launch (at randomized delay after Stage 3)
    const greenTimer = setTimeout(() => {
      const greenTime = Date.now();
      startRace(greenTime);
      soundEngine.playGoTone();
    }, totalDurationBeforeGreen);

    return () => {
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(greenTimer);
    };
  }, [raceState, setCountdownStage, startRace]);

  // Track solve record completion once per race
  const hasRecordedCurrentRaceRef = useRef(false);

  useEffect(() => {
    if (raceState === 'RACING') {
      hasRecordedCurrentRaceRef.current = false;
    }

    if (raceState === 'FINISHED' && !hasRecordedCurrentRaceRef.current) {
      hasRecordedCurrentRaceRef.current = true;

      const currentTimerPlayers = useTimerStore.getState().players;
      const solvesData: Record<
        string,
        { rawTimeMs: number; falseStartDeltaMs: number; penalty: PenaltyType }
      > = {};

      activePlayersRef.current.forEach((p) => {
        const tp = currentTimerPlayers[p.id];
        const raw = tp?.finishTimeMs || tp?.rawTimeMs || 0;
        solvesData[p.id] = {
          rawTimeMs: raw,
          falseStartDeltaMs: tp?.falseStartDeltaMs || 0,
          penalty: tp?.penalty || 'NONE',
        };
      });

      const { matchWinnerId, setWinnerId } = recordCompletedGame(solvesData);

      if (matchWinnerId || setWinnerId) {
        soundEngine.playVictoryFanfare();
      }
    }
  }, [raceState, recordCompletedGame]);

  // Keyboard Spacebar Controller for the Host Player
  useEffect(() => {
    const handleKeyDownEvent = (e: KeyboardEvent) => {
      if (isAdminOpenRef.current) return;
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        const val = (target as HTMLInputElement).value;
        if (val === '') {
          target.blur();
          // Fall through to execute timer
        } else {
          return;
        }
      }

      const host = hostPlayerRef.current;
      if (!host) return;

      e.preventDefault();
      const currentRaceState = useTimerStore.getState().raceState;

      if (currentRaceState === 'RACING') {
        const rank = stopPlayer(host.id, Date.now());
        if (rank > 0) {
          soundEngine.playFinishChime(rank);
          const tp = useTimerStore.getState().players[host.id];
          const rawMs = tp?.finishTimeMs || 0;
          const timeFormatted = formatTime(rawMs);
          const tState = useTournamentStore.getState();
          const currentGame = tState.sets[tState.currentSetIndex]?.games[tState.currentGameIndex];

          tState.addActivityItem({
            type: 'SOLVE_FINISHED',
            playerId: host.id,
            playerName: host.name,
            playerColor: host.color,
            team: host.team,
            timeMs: rawMs,
            penalty: 'NONE',
            rank,
            gameId: currentGame?.id,
            roundIndex: tState.currentRoundIndex,
            message: `${host.name} finished in ${timeFormatted}${rawMs < 60000 ? 's' : ''} (#${rank})`,
          });

          if ((tp?.falseStartDeltaMs || 0) > 0) {
            tState.addActivityItem({
              type: 'FALSE_START',
              playerId: host.id,
              playerName: host.name,
              playerColor: host.color,
              team: host.team,
              message: `⚠️ ${host.name} early release (+${(
                ((tp?.falseStartDeltaMs || 0) * tState.settings.falseStartMultiplier) /
                1000
              ).toFixed(2)}s)`,
            });
          }
        }
      } else {
        handleKeyDown(host.id, Date.now(), () => {
          useTournamentStore.getState().startNextGame();
        });
      }
    };

    const handleKeyUpEvent = (e: KeyboardEvent) => {
      if (isAdminOpenRef.current) return;
      if (e.code !== 'Space' && e.key !== ' ') return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const host = hostPlayerRef.current;
      if (!host) return;

      e.preventDefault();
      const result = handleKeyUp(host.id, Date.now());
      if (result.isFalseStart) {
        soundEngine.playFalseStart();
      }
    };

    window.addEventListener('keydown', handleKeyDownEvent);
    window.addEventListener('keyup', handleKeyUpEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDownEvent);
      window.removeEventListener('keyup', handleKeyUpEvent);
    };
  }, [stopPlayer, handleKeyDown, handleKeyUp]);
}
