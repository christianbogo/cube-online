import type { StateCreator } from 'zustand';
import type { TournamentStore } from '../tournamentStore';
import type { Game, SetMatch, Solve, Round, PenaltyType, TeamId, MatchPlaceResult } from '@/types/tournament';
import { generateWcaScramble } from '@/utils/scramble';
import { formatTime } from '@/utils/formatters';
import { auth } from '@/lib/firebase';
import { saveMatch } from '@/lib/matchLibrary';

export interface MatchSlice {
  matchId: string;
  matchStatus: 'SETUP' | 'IN_PROGRESS' | 'COMPLETED';
  isRoomActive: boolean;
  connectedGuests: string[];
  currentSetIndex: number;
  currentGameIndex: number;
  currentRoundIndex: number;
  sets: SetMatch[];
  currentScramble: string;
  isScrambleLoading: boolean;
  currentGameSolves: Record<string, Solve>;
  currentGamePoints: Record<string, number>;
  lastRoundScores: Record<string, number>;
  lastMatchPlaces: MatchPlaceResult[];
  totalPoints: Record<string, number>;
  setWins: Record<string, number>;
  gameWins: Record<string, number>;
  teamGamePoints: Record<TeamId, number>;
  teamTotalPoints: Record<TeamId, number>;
  teamSetWins: Record<TeamId, number>;
  teamGameWins: Record<TeamId, number>;
  matchBestTimeMs: number | null;
  setBestTimeMs: number | null;
  gameBestTimeMs: number | null;
  matchWinnerPlayerId: string | null;
  matchWinnerTeamId: TeamId | null;

  setIsRoomActive: (active: boolean) => void;
  setConnectedGuests: (guests: string[]) => void;
  startMatch: () => Promise<void>;
  resetCurrentGame: () => void;
  startNextGame: () => void;
  generateNewScramble: () => Promise<string>;
  setScrambleManually: (scramble: string) => void;
  recordCompletedGame: (
    solves: Record<string, { rawTimeMs: number; penalty: PenaltyType; falseStartDeltaMs: number }>
  ) => {
    gameWinnerId?: string;
    setWinnerId?: string;
    matchWinnerId?: string;
    gameWinnerTeam?: TeamId;
    setWinnerTeam?: TeamId;
    matchWinnerTeam?: TeamId;
    isGameWon: boolean;
    highlight?: {
      type: 'HIGHLIGHT_SET' | 'HIGHLIGHT_GAME';
      playerId: string;
      playerName: string;
      playerColor: string;
      team?: TeamId;
      timeMs: number;
      formattedTime: string;
      message: string;
    };
  };
  applyPenalty: (gameId: string, playerId: string, penalty: PenaltyType, roundId?: string) => void;
  recalculateAllScores: () => void;
  clearLastMatchPlaces: () => void;
  cancelMatchToSetup: () => void;
  resetTournament: () => void;
}

export const createMatchSlice: StateCreator<TournamentStore, [['zustand/immer', never]], [], MatchSlice> = (set, get) => ({
  matchId: Math.floor(100000 + Math.random() * 900000).toString(),
  matchStatus: 'SETUP',
  isRoomActive: false,
  connectedGuests: [],
  currentSetIndex: 0,
  currentGameIndex: 0,
  currentRoundIndex: 0,
  sets: [],
  currentScramble: "R U R' U' R' F R2 U' R' U' R U R' F'",
  isScrambleLoading: false,
  currentGameSolves: {},
  currentGamePoints: {},
  lastRoundScores: {},
  lastMatchPlaces: [],
  totalPoints: {},
  setWins: {},
  gameWins: {},
  teamGamePoints: { RED: 0, BLUE: 0 },
  teamTotalPoints: { RED: 0, BLUE: 0 },
  teamSetWins: { RED: 0, BLUE: 0 },
  teamGameWins: { RED: 0, BLUE: 0 },
  matchBestTimeMs: null,
  setBestTimeMs: null,
  gameBestTimeMs: null,
  matchWinnerPlayerId: null,
  matchWinnerTeamId: null,

  setIsRoomActive: (active: boolean) => set((state) => { state.isRoomActive = active; }),
  setConnectedGuests: (guests: string[]) => set((state) => { state.connectedGuests = guests; }),

  startMatch: async () => {
    const initialGame: Game = {
      id: 'game-1-1',
      gameIndex: 0,
      rounds: [
        {
          id: 'round-game-1-1-1',
          roundIndex: 0,
          solves: {},
          completed: false,
          completedAt: null,
        },
      ],
      solves: {},
      scores: {},
      winnerId: null,
      winnerTeam: null,
      completed: false,
      completedAt: null,
    };

    const initialSet: SetMatch = {
      id: 'set-1',
      setIndex: 0,
      games: [initialGame],
      winnerId: null,
      winnerTeam: null,
      completed: false,
      completedAt: null,
    };

    set((state) => {
      state.matchStatus = 'IN_PROGRESS';
      state.currentSetIndex = 0;
      state.currentGameIndex = 0;
      state.currentRoundIndex = 0;
      state.sets = [initialSet];
      state.currentGameSolves = {};
      state.currentGamePoints = {};
      state.lastRoundScores = {};
      state.lastMatchPlaces = [];
      state.totalPoints = {};
      state.setWins = {};
      state.gameWins = {};
      state.teamGamePoints = { RED: 0, BLUE: 0 };
      state.teamTotalPoints = { RED: 0, BLUE: 0 };
      state.teamSetWins = { RED: 0, BLUE: 0 };
      state.teamGameWins = { RED: 0, BLUE: 0 };
      state.matchBestTimeMs = null;
      state.setBestTimeMs = null;
      state.gameBestTimeMs = null;
      state.matchWinnerPlayerId = null;
      state.matchWinnerTeamId = null;
      state.activityFeed = [];
    });

    await get().generateNewScramble();
  },

  generateNewScramble: async () => {
    const { settings } = get();
    set((state) => { state.isScrambleLoading = true; });
    try {
      const scramble = await generateWcaScramble(settings.scrambleEvent || '333');
      set((state) => {
        state.currentScramble = scramble;
        state.isScrambleLoading = false;
      });
      return scramble;
    } catch {
      const fallback = "R U R' U' R' F R2 U' R' U' R U R' F'";
      set((state) => {
        state.currentScramble = fallback;
        state.isScrambleLoading = false;
      });
      return fallback;
    }
  },

  setScrambleManually: (scramble) => {
    set((state) => { state.currentScramble = scramble; });
  },

  resetCurrentGame: () => {
    set((state) => { state.currentGameSolves = {}; });
  },

  startNextGame: () => {
    set((state) => {
      const { settings, players } = state;
      const currentSet = state.sets[state.currentSetIndex];
      if (!currentSet) return;

      const currentGame = currentSet.games[state.currentGameIndex];
      if (!currentGame) return;

      const isTeamMode = settings.tournamentMode === 'TEAMS';

      if (currentGame.completed) {
        let isSetWon = false;
        if (isTeamMode) {
          const redWins = state.teamGameWins.RED || 0;
          const blueWins = state.teamGameWins.BLUE || 0;
          isSetWon = redWins >= settings.targetGames || blueWins >= settings.targetGames;
        } else {
          isSetWon = Object.values(state.gameWins).some((wins) => wins >= settings.targetGames);
        }

        if (isSetWon) {
          const nextSetIndex = state.currentSetIndex + 1;
          const nextGame: Game = {
            id: `game-${nextSetIndex + 1}-1`,
            gameIndex: 0,
            rounds: [{ id: `round-game-${nextSetIndex + 1}-1-1`, roundIndex: 0, solves: {}, completed: false, completedAt: null }],
            solves: {}, scores: {}, winnerId: null, winnerTeam: null, completed: false, completedAt: null,
          };
          const nextSet: SetMatch = {
            id: `set-${nextSetIndex + 1}`,
            setIndex: nextSetIndex,
            games: [nextGame],
            winnerId: null, winnerTeam: null, completed: false, completedAt: null,
          };

          state.sets.push(nextSet);
          state.currentSetIndex = nextSetIndex;
          state.currentGameIndex = 0;
          state.currentRoundIndex = 0;
          state.currentGamePoints = {};
          state.lastRoundScores = {};
          state.currentGameSolves = {};
          
          players.forEach((p) => { state.gameWins[p.id] = 0; });
          state.teamGameWins = { RED: 0, BLUE: 0 };
          state.teamGamePoints = { RED: 0, BLUE: 0 };
          state.setBestTimeMs = null;
          state.gameBestTimeMs = null;
        } else {
          const nextGameIndex = state.currentGameIndex + 1;
          const nextGame: Game = {
            id: `game-${state.currentSetIndex + 1}-${nextGameIndex + 1}`,
            gameIndex: nextGameIndex,
            rounds: [{ id: `round-game-${state.currentSetIndex + 1}-${nextGameIndex + 1}-1`, roundIndex: 0, solves: {}, completed: false, completedAt: null }],
            solves: {}, scores: {}, winnerId: null, winnerTeam: null, completed: false, completedAt: null,
          };

          currentSet.games.push(nextGame);
          state.currentGameIndex = nextGameIndex;
          state.currentRoundIndex = 0;
          state.currentGamePoints = {};
          state.lastRoundScores = {};
          state.currentGameSolves = {};
          state.teamGamePoints = { RED: 0, BLUE: 0 };
          state.gameBestTimeMs = null;
        }
      } else {
        const nextRoundIndex = state.currentRoundIndex + 1;
        const nextRound: Round = {
          id: `round-${currentGame.id}-${nextRoundIndex + 1}`,
          roundIndex: nextRoundIndex,
          solves: {},
          completed: false,
          completedAt: null,
        };

        currentGame.rounds.push(nextRound);
        state.currentRoundIndex = nextRoundIndex;
        state.currentGameSolves = {};
      }
    });
  },

  recordCompletedGame: (solvesData) => {
    const state = get();
    const { players, settings, currentSetIndex, currentGameIndex, currentRoundIndex } = state;
    const currentSet = state.sets[currentSetIndex];
    if (!currentSet) return { isGameWon: false };
    const currentGame = currentSet.games[currentGameIndex];
    if (!currentGame) return { isGameWon: false };

    const activePlayers = players.filter((p) => p.active);
    const roundSolves: Record<string, Solve> = {};
    let newMatchBest = state.matchBestTimeMs;
    let newSetBest = state.setBestTimeMs;
    let newGameBest = state.gameBestTimeMs;
    let roundHighlight: {
      type: 'HIGHLIGHT_SET' | 'HIGHLIGHT_GAME';
      playerId: string;
      playerName: string;
      playerColor: string;
      team?: TeamId;
      timeMs: number;
      formattedTime: string;
      message: string;
    } | undefined = undefined;

    set((draft) => {
      activePlayers.forEach((p) => {
        const data = solvesData[p.id] || { rawTimeMs: 0, penalty: 'NONE', falseStartDeltaMs: 0 };
        const falseStartPenalty = data.falseStartDeltaMs * settings.falseStartMultiplier;
        const plus2Penalty = data.penalty === 'PLUS_2' ? 2000 : 0;
        const timeNerf = p.timeNerfMs || 0;
        const isDNF = data.penalty === 'DNF';
        const finalTimeMs = isDNF ? 0 : data.rawTimeMs + falseStartPenalty + plus2Penalty + timeNerf;
        const timeFormatted = formatTime(finalTimeMs, { penalty: data.penalty });
        const timeSuffix = !isDNF && finalTimeMs < 60000 ? 's' : '';

        roundSolves[p.id] = {
          id: `solve-${currentGame.id}-r${currentRoundIndex + 1}-${p.id}`,
          playerId: p.id,
          gameId: currentGame.id,
          roundIndex: currentRoundIndex,
          rawTimeMs: data.rawTimeMs,
          penalty: data.penalty,
          falseStartDeltaMs: data.falseStartDeltaMs,
          finalTimeMs,
          score: 0, // Recalculated below
          isDNF,
          completedAt: Date.now(),
        };

        const alreadyLogged = draft.activityFeed.some(
          (a) => a.type === 'SOLVE_FINISHED' && a.gameId === currentGame.id && a.roundIndex === currentRoundIndex && a.playerId === p.id
        );

        if (!alreadyLogged) {
          draft.activityFeed.unshift({
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'SOLVE_FINISHED',
            playerId: p.id,
            playerName: p.name,
            playerColor: p.color,
            team: p.team,
            timeMs: finalTimeMs,
            penalty: data.penalty,
            gameId: currentGame.id,
            roundIndex: currentRoundIndex,
            message: `${p.name} finished in ${timeFormatted}${timeSuffix}`,
          });
        }

        if (data.falseStartDeltaMs > 0) {
          const alreadyLoggedFS = draft.activityFeed.some(
            (a) => a.type === 'FALSE_START' && a.playerId === p.id && Date.now() - a.timestamp < 10000
          );
          if (!alreadyLoggedFS) {
            draft.activityFeed.unshift({
              id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timestamp: Date.now(),
              type: 'FALSE_START',
              playerId: p.id,
              playerName: p.name,
              playerColor: p.color,
              team: p.team,
              message: `${p.name} early release (+${(falseStartPenalty / 1000).toFixed(2)}s)`,
            });
          }
        }
      });

      const validRoundSolves = Object.values(roundSolves).filter((s) => !s.isDNF && s.finalTimeMs > 0);
      validRoundSolves.sort((a, b) => a.finalTimeMs - b.finalTimeMs);
      const fastestRoundSolve = validRoundSolves.length > 0 ? validRoundSolves[0] : null;

      if (fastestRoundSolve) {
        const bestPlayer = draft.players.find((p) => p.id === fastestRoundSolve.playerId);
        const bestFormattedTime = formatTime(fastestRoundSolve.finalTimeMs);
        const timeSuffix = fastestRoundSolve.finalTimeMs < 60000 ? 's' : '';
        const previousMatchBest = state.matchBestTimeMs;
        const previousSetBest = state.setBestTimeMs;
        const previousGameBest = state.gameBestTimeMs;

        if (!previousMatchBest || fastestRoundSolve.finalTimeMs < previousMatchBest) {
          newMatchBest = fastestRoundSolve.finalTimeMs;
          draft.activityFeed.unshift({
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'RECORD_BROKEN',
            playerId: fastestRoundSolve.playerId,
            playerName: bestPlayer?.name,
            playerColor: bestPlayer?.color,
            timeMs: fastestRoundSolve.finalTimeMs,
            recordType: 'MATCH_RECORD',
            message: `Match Record: ${bestFormattedTime}${timeSuffix} by ${bestPlayer?.name}`,
          });
        }

        if (!previousSetBest || fastestRoundSolve.finalTimeMs < previousSetBest) {
          newSetBest = fastestRoundSolve.finalTimeMs;
          newGameBest = fastestRoundSolve.finalTimeMs;
          roundHighlight = {
            type: 'HIGHLIGHT_SET',
            playerId: fastestRoundSolve.playerId,
            playerName: bestPlayer?.name || 'Player',
            playerColor: bestPlayer?.color || '#cccccc',
            team: bestPlayer?.team,
            timeMs: fastestRoundSolve.finalTimeMs,
            formattedTime: `${bestFormattedTime}${timeSuffix}`,
            message: `${bestPlayer?.name || 'Player'} had the fastest solve of the set (${bestFormattedTime}${timeSuffix})`,
          };
          draft.activityFeed.unshift({
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'HIGHLIGHT_SET',
            playerId: fastestRoundSolve.playerId,
            playerName: bestPlayer?.name,
            playerColor: bestPlayer?.color,
            team: bestPlayer?.team,
            timeMs: fastestRoundSolve.finalTimeMs,
            recordType: 'SET_RECORD',
            message: roundHighlight.message,
          });
        } else if (!previousGameBest || fastestRoundSolve.finalTimeMs < previousGameBest) {
          newGameBest = fastestRoundSolve.finalTimeMs;
          roundHighlight = {
            type: 'HIGHLIGHT_GAME',
            playerId: fastestRoundSolve.playerId,
            playerName: bestPlayer?.name || 'Player',
            playerColor: bestPlayer?.color || '#cccccc',
            team: bestPlayer?.team,
            timeMs: fastestRoundSolve.finalTimeMs,
            formattedTime: `${bestFormattedTime}${timeSuffix}`,
            message: `${bestPlayer?.name || 'Player'} had the fastest solve of the game (${bestFormattedTime}${timeSuffix})`,
          };
          draft.activityFeed.unshift({
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            type: 'HIGHLIGHT_GAME',
            playerId: fastestRoundSolve.playerId,
            playerName: bestPlayer?.name,
            playerColor: bestPlayer?.color,
            team: bestPlayer?.team,
            timeMs: fastestRoundSolve.finalTimeMs,
            recordType: 'GAME_RECORD',
            message: roundHighlight.message,
          });
        }
      }

      const draftSet = draft.sets[currentSetIndex];
      const draftGame = draftSet.games[currentGameIndex];
      let draftRound = draftGame.rounds.find((r) => r.roundIndex === currentRoundIndex);
      if (!draftRound) {
        draftRound = { id: `round-${draftGame.id}-${currentRoundIndex + 1}`, roundIndex: currentRoundIndex, solves: {}, completed: false, completedAt: null };
        draftGame.rounds.push(draftRound);
      }
      draftRound.solves = roundSolves;
      draftRound.completed = true;
      draftRound.completedAt = Date.now();
      draftGame.solves = roundSolves;

      draft.currentGameSolves = roundSolves;
      draft.matchBestTimeMs = newMatchBest;
      draft.setBestTimeMs = newSetBest;
      draft.gameBestTimeMs = newGameBest;
      
      if (draft.activityFeed.length > 100) {
        draft.activityFeed = draft.activityFeed.slice(0, 100);
      }
    });

    get().recalculateAllScores();

    const finalState = get();
    const finalSet = finalState.sets[currentSetIndex];
    const finalGame = finalSet?.games[currentGameIndex];

    const gameWinnerTeam = finalGame?.winnerTeam;
    const gameWinnerId = finalGame?.winnerId;
    const setWinnerTeam = finalSet?.winnerTeam;
    const setWinnerId = finalSet?.winnerId;
    const matchWinnerTeam = finalState.matchWinnerTeamId;
    const matchWinnerId = finalState.matchWinnerPlayerId;

    set((draft) => {
      const generateId = () => `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (gameWinnerTeam) {
        draft.activityFeed.unshift({ id: generateId(), timestamp: Date.now(), type: 'GAME_WON', team: gameWinnerTeam, message: `${gameWinnerTeam} TEAM won Game ${currentGameIndex + 1}` });
      } else if (gameWinnerId) {
        const winnerP = draft.players.find((p) => p.id === gameWinnerId);
        draft.activityFeed.unshift({ id: generateId(), timestamp: Date.now(), type: 'GAME_WON', playerId: gameWinnerId, playerName: winnerP?.name, playerColor: winnerP?.color, message: `${winnerP?.name} won Game ${currentGameIndex + 1}` });
      }

      if (setWinnerTeam) {
        draft.activityFeed.unshift({ id: generateId(), timestamp: Date.now(), type: 'SET_WON', team: setWinnerTeam, message: `${setWinnerTeam} TEAM won Set ${currentSetIndex + 1}` });
        draft.setBestTimeMs = null;
      } else if (setWinnerId) {
        const winnerP = draft.players.find((p) => p.id === setWinnerId);
        draft.activityFeed.unshift({ id: generateId(), timestamp: Date.now(), type: 'SET_WON', playerId: setWinnerId, playerName: winnerP?.name, playerColor: winnerP?.color, message: `${winnerP?.name} won Set ${currentSetIndex + 1}` });
        draft.setBestTimeMs = null;
      }

      if (matchWinnerTeam) {
        draft.activityFeed.unshift({ id: generateId(), timestamp: Date.now(), type: 'MATCH_WON', team: matchWinnerTeam, message: `${matchWinnerTeam} TEAM won the Tournament` });
      } else if (matchWinnerId) {
        const winnerP = draft.players.find((p) => p.id === matchWinnerId);
        draft.activityFeed.unshift({ id: generateId(), timestamp: Date.now(), type: 'MATCH_WON', playerId: matchWinnerId, playerName: winnerP?.name, playerColor: winnerP?.color, message: `${winnerP?.name} won the Tournament` });
      }
      
      if (draft.activityFeed.length > 100) {
        draft.activityFeed = draft.activityFeed.slice(0, 100);
      }
    });

    if (!matchWinnerId && !matchWinnerTeam) {
      get().generateNewScramble();
    } else {
      set((draft) => { draft.matchStatus = 'COMPLETED'; });
      const finalFinishedState = get();
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        try {
          saveMatch(
            auth.currentUser.uid,
            finalFinishedState.matchId,
            finalFinishedState.sets,
            finalFinishedState.players,
            finalFinishedState.matchWinnerPlayerId,
            finalFinishedState.matchWinnerTeamId,
            finalFinishedState.settings
          ).catch(console.error);
        } catch (e) {
          console.warn('Failed to save match', e);
        }
      }
    }

    return {
      gameWinnerId: gameWinnerId || undefined,
      setWinnerId: setWinnerId || undefined,
      matchWinnerId: matchWinnerId || undefined,
      gameWinnerTeam: gameWinnerTeam || undefined,
      setWinnerTeam: setWinnerTeam || undefined,
      matchWinnerTeam: matchWinnerTeam || undefined,
      isGameWon: !!(gameWinnerId || gameWinnerTeam),
      highlight: roundHighlight,
    };
  },

  applyPenalty: (gameId, playerId, penalty, roundId) => {
    set((state) => {
      const g = state.sets.flatMap(s => s.games).find(g => g.id === gameId);
      if (g) {
        g.rounds.forEach(r => {
          if (roundId && r.id !== roundId) return;
          if (r.solves[playerId]) r.solves[playerId].penalty = penalty;
        });
        if (g.solves[playerId]) g.solves[playerId].penalty = penalty;
      }
      state.activityFeed.forEach(item => {
        if (item.type === 'SOLVE_FINISHED' && item.playerId === playerId && item.gameId === gameId) {
          item.penalty = penalty;
        }
      });
      const p = state.players.find(x => x.id === playerId);
      state.activityFeed.unshift({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        type: 'PENALTY_APPLIED',
        playerId,
        playerName: p?.name,
        playerColor: p?.color,
        team: p?.team,
        penalty,
        message: `⚖️ Admin marked ${p?.name} as ${penalty === 'PLUS_2' ? '+2' : penalty}`,
      });
      if (state.activityFeed.length > 100) state.activityFeed = state.activityFeed.slice(0, 100);
    });
    get().recalculateAllScores();
  },

  recalculateAllScores: () => {
    set((state) => {
      const activePlayers = state.players.filter((p) => p.active);
      const isTeamMode = state.settings.tournamentMode === 'TEAMS';

      let overallMatchWinnerPlayerId: string | null = null;
      let overallMatchWinnerTeamId: TeamId | null = null;

      state.sets.forEach((s, sIdx) => {
        let setWinnerId: string | null = null;
        let setWinnerTeam: TeamId | null = null;

        const setGameWins: Record<string, number> = {};
        const setTeamGameWins: Record<TeamId, number> = { RED: 0, BLUE: 0 };
        state.players.forEach((p) => (setGameWins[p.id] = 0));

        s.games.forEach((g, gIdx) => {
          const runningGamePoints: Record<string, number> = {};
          const runningTeamPoints: Record<TeamId, number> = { RED: 0, BLUE: 0 };
          state.players.forEach((p) => (runningGamePoints[p.id] = 0));

          const lastRoundCalculatedScores: Record<string, number> = {};
          const latestRoundSolvesMap: Record<string, Solve> = {};

          g.rounds.forEach((r) => {
            const rawSolves = r.solves || {};
            const solvedList: { playerId: string; effectiveTimeMs: number; isDNF: boolean; rawSolve: Solve }[] = [];

            activePlayers.forEach((p) => {
              const solve = rawSolves[p.id];
              if (solve) {
                const fsPenalty = (solve.falseStartDeltaMs || 0) * state.settings.falseStartMultiplier;
                const plus2 = solve.penalty === 'PLUS_2' ? 2000 : 0;
                const timeNerf = p.timeNerfMs || 0;
                const isDNF = solve.penalty === 'DNF';
                const effective = isDNF ? 99999999 : solve.rawTimeMs + fsPenalty + plus2 + timeNerf;
                solvedList.push({ playerId: p.id, effectiveTimeMs: effective, isDNF, rawSolve: solve });
              }
            });

            solvedList.sort((a, b) => a.effectiveTimeMs - b.effectiveTimeMs);
            const valid = solvedList.filter((x) => !x.isDNF);
            const fastestMs = valid.length > 0 ? valid[0].effectiveTimeMs : 0;

            solvedList.forEach((item, idx) => {
              const rank = idx + 1;
              let score = 0;
              score = item.isDNF ? 0 : Math.max(1, activePlayers.length - (rank - 1));

              const fsDelta = item.rawSolve.falseStartDeltaMs || 0;
              const plus2 = item.rawSolve.penalty === 'PLUS_2' ? 2000 : 0;
              const pObj = state.players.find((p) => p.id === item.playerId);
              const timeNerf = pObj?.timeNerfMs || 0;
              const finalTimeMs = item.isDNF ? 0 : item.rawSolve.rawTimeMs + fsDelta * state.settings.falseStartMultiplier + plus2 + timeNerf;

              if (!r.solves) r.solves = {};
              if (!r.solves[item.playerId]) r.solves[item.playerId] = { ...item.rawSolve, rank, score, finalTimeMs };
              else {
                r.solves[item.playerId].rank = rank;
                r.solves[item.playerId].score = score;
                r.solves[item.playerId].finalTimeMs = finalTimeMs;
              }

              latestRoundSolvesMap[item.playerId] = r.solves[item.playerId];
              lastRoundCalculatedScores[item.playerId] = score;

              runningGamePoints[item.playerId] = (runningGamePoints[item.playerId] || 0) + score;
              const team = pObj?.team || 'RED';
              runningTeamPoints[team] = (runningTeamPoints[team] || 0) + score;
            });
          });

          g.scores = runningGamePoints;
          g.solves = latestRoundSolvesMap;

          let gameWinnerId: string | null = null;
          let gameWinnerTeam: TeamId | null = null;

          if (isTeamMode) {
            const redPts = runningTeamPoints.RED || 0;
            const bluePts = runningTeamPoints.BLUE || 0;
            if (redPts >= state.settings.rankPointsFloor || bluePts >= state.settings.rankPointsFloor) {
              if (redPts > bluePts) gameWinnerTeam = 'RED';
              else if (bluePts > redPts) gameWinnerTeam = 'BLUE';
            }
          } else {
            const eligible = Object.entries(runningGamePoints).filter(([, pts]) => pts >= state.settings.rankPointsFloor).sort((a, b) => b[1] - a[1]);
            if (eligible.length > 0 && (eligible.length === 1 || eligible[0][1] > eligible[1][1])) {
              gameWinnerId = eligible[0][0];
            }
          }

          g.winnerId = gameWinnerId;
          g.winnerTeam = gameWinnerTeam;
          g.completed = !!(gameWinnerId || gameWinnerTeam);

          if (g.completed) {
            if (gameWinnerTeam) setTeamGameWins[gameWinnerTeam] = (setTeamGameWins[gameWinnerTeam] || 0) + 1;
            else if (gameWinnerId) setGameWins[gameWinnerId] = (setGameWins[gameWinnerId] || 0) + 1;
          }

          if (sIdx === state.currentSetIndex && gIdx === state.currentGameIndex) {
            state.currentGamePoints = runningGamePoints;
            state.teamGamePoints = runningTeamPoints;
            state.lastRoundScores = lastRoundCalculatedScores;
            state.currentGameSolves = latestRoundSolvesMap;

            if (Object.keys(latestRoundSolvesMap).length > 0) {
              const places: MatchPlaceResult[] = Object.values(latestRoundSolvesMap)
                .map(s => {
                  const p = state.players.find(x => x.id === s.playerId);
                  return {
                    playerId: s.playerId,
                    name: p?.name || 'Player',
                    color: p?.color || '#cccccc',
                    team: p?.team,
                    rank: s.rank ?? 999,
                    timeMs: s.finalTimeMs,
                    penalty: s.penalty,
                    isDNF: s.isDNF,
                    score: s.score,
                    falseStartDeltaMs: s.falseStartDeltaMs,
                  };
                })
                .sort((a, b) => a.rank - b.rank);

              if (places.length > 0) {
                state.lastMatchPlaces = places;
              }
            }
          }
        });

        if (isTeamMode) {
          if (setTeamGameWins.RED >= state.settings.targetGames) setWinnerTeam = 'RED';
          else if (setTeamGameWins.BLUE >= state.settings.targetGames) setWinnerTeam = 'BLUE';
        } else {
          Object.entries(setGameWins).forEach(([pid, gw]) => {
            if (gw >= state.settings.targetGames && !setWinnerId) setWinnerId = pid;
          });
        }

        s.winnerId = setWinnerId;
        s.winnerTeam = setWinnerTeam;
        s.completed = !!(setWinnerId || setWinnerTeam);

        if (sIdx === state.currentSetIndex) {
          state.gameWins = setGameWins;
          state.teamGameWins = setTeamGameWins;
        }
      });

      const accumulatedSetWins: Record<string, number> = {};
      const accumulatedTeamSetWins: Record<TeamId, number> = { RED: 0, BLUE: 0 };
      const accumulatedTotalPoints: Record<string, number> = {};
      const accumulatedTeamTotalPoints: Record<TeamId, number> = { RED: 0, BLUE: 0 };

      state.players.forEach(p => { accumulatedSetWins[p.id] = 0; accumulatedTotalPoints[p.id] = 0; });

      state.sets.forEach(s => {
        if (s.winnerTeam) accumulatedTeamSetWins[s.winnerTeam]++;
        else if (s.winnerId) accumulatedSetWins[s.winnerId]++;
        
        s.games.forEach(g => {
          Object.entries(g.scores || {}).forEach(([pid, sc]) => {
            accumulatedTotalPoints[pid] += sc;
            const t = state.players.find(p => p.id === pid)?.team || 'RED';
            accumulatedTeamTotalPoints[t] += sc;
          });
        });
      });

      if (isTeamMode) {
        if (accumulatedTeamSetWins.RED >= state.settings.targetSets) overallMatchWinnerTeamId = 'RED';
        else if (accumulatedTeamSetWins.BLUE >= state.settings.targetSets) overallMatchWinnerTeamId = 'BLUE';
      } else {
        Object.entries(accumulatedSetWins).forEach(([pid, sw]) => {
          if (sw >= state.settings.targetSets && !overallMatchWinnerPlayerId) overallMatchWinnerPlayerId = pid;
        });
      }

      state.setWins = accumulatedSetWins;
      state.teamSetWins = accumulatedTeamSetWins;
      state.totalPoints = accumulatedTotalPoints;
      state.teamTotalPoints = accumulatedTeamTotalPoints;
      state.matchWinnerPlayerId = overallMatchWinnerPlayerId;
      state.matchWinnerTeamId = overallMatchWinnerTeamId;
    });
  },

  clearLastMatchPlaces: () => {
    set((state) => {
      state.lastMatchPlaces = [];
    });
  },

  cancelMatchToSetup: () => {
    const currentMatchId = get().matchId;
    get().resetTournament();
    set((state) => {
      state.matchId = currentMatchId;
    });
  },

  resetTournament: () => {
    set((state) => {
      state.matchId = Math.floor(100000 + Math.random() * 900000).toString();
      state.matchStatus = 'SETUP';
      state.isRoomActive = false;
      state.connectedGuests = [];
      state.currentSetIndex = 0;
      state.currentGameIndex = 0;
      state.currentRoundIndex = 0;
      state.sets = [];
      state.currentGameSolves = {};
      state.currentGamePoints = {};
      state.lastRoundScores = {};
      state.lastMatchPlaces = [];
      state.totalPoints = {};
      state.setWins = {};
      state.gameWins = {};
      state.teamGamePoints = { RED: 0, BLUE: 0 };
      state.teamTotalPoints = { RED: 0, BLUE: 0 };
      state.teamSetWins = { RED: 0, BLUE: 0 };
      state.teamGameWins = { RED: 0, BLUE: 0 };
      state.matchBestTimeMs = null;
      state.setBestTimeMs = null;
      state.gameBestTimeMs = null;
      state.matchWinnerPlayerId = null;
      state.matchWinnerTeamId = null;
      state.activityFeed = [];
    });
  },
});
