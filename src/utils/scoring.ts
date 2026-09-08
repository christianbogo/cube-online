import type { PenaltyType, Player, Solve, TournamentSettings } from '@/types/tournament';

/**
 * Calculates finalTimeMs taking into account rawTime, penalties (+2s), and false start delta penalties.
 */
export function computeFinalTime(
  rawTimeMs: number,
  penalty: PenaltyType,
  falseStartDeltaMs: number = 0,
  falseStartMultiplier: number = 5
): { finalTimeMs: number; isDNF: boolean } {
  if (penalty === 'DNF') {
    return { finalTimeMs: Infinity, isDNF: true };
  }

  let finalTime = rawTimeMs;

  // Add false start penalty if any
  if (falseStartDeltaMs > 0) {
    finalTime += falseStartDeltaMs * falseStartMultiplier;
  }

  // Add +2.00s penalty (2000ms)
  if (penalty === 'PLUS_2') {
    finalTime += 2000;
  }

  return { finalTimeMs: finalTime, isDNF: false };
}

export interface CalculatedSolveResult {
  playerId: string;
  rawTimeMs: number;
  finalTimeMs: number;
  penalty: PenaltyType;
  falseStartDeltaMs: number;
  isDNF: boolean;
  rank: number;
  score: number;
}

/**
 * Computes ranks and scores for a set of solves according to the tournament settings.
 */
export function calculateGameScores(
  solves: Record<string, Solve | { rawTimeMs: number; penalty?: PenaltyType; falseStartDeltaMs?: number }>,
  players: Player[],
  settings: TournamentSettings
): Record<string, CalculatedSolveResult> {
  const activePlayers = players.filter((p) => p.active);
  const totalActive = activePlayers.length;

  // 1. Calculate final times for all active players who have a solve
  const solveEntries = activePlayers.map((player) => {
    const s = solves[player.id];
    const rawTimeMs = s ? s.rawTimeMs : 0;
    const penalty: PenaltyType = s?.penalty || 'NONE';
    const falseStartDeltaMs = s?.falseStartDeltaMs || 0;

    const { finalTimeMs, isDNF } = computeFinalTime(
      rawTimeMs,
      penalty,
      falseStartDeltaMs,
      settings.falseStartMultiplier
    );

    return {
      playerId: player.id,
      rawTimeMs,
      finalTimeMs,
      penalty,
      falseStartDeltaMs,
      isDNF,
      hasSolve: !!s && rawTimeMs > 0,
    };
  });

  // 2. Separate valid solves from DNFs / missing solves
  const validSolves = solveEntries.filter((e) => e.hasSolve && !e.isDNF);
  const dnfSolves = solveEntries.filter((e) => !e.hasSolve || e.isDNF);

  // Sort valid solves by finalTimeMs ascending
  validSolves.sort((a, b) => a.finalTimeMs - b.finalTimeMs);

  const results: Record<string, CalculatedSolveResult> = {};

  if (settings.scoringMode === 'RANK_BASED') {
    // Rank-based scoring:
    // 1st place receives N points (+ firstPlaceBonus)
    // 2nd receives N-1, down to 1 point.
    // DNF receives 0 points.
    validSolves.forEach((entry, idx) => {
      const rank = idx + 1;
      let points = totalActive - idx;
      if (rank === 1 && totalActive > 0) {
        points += settings.firstPlaceBonus;
      }
      results[entry.playerId] = {
        playerId: entry.playerId,
        rawTimeMs: entry.rawTimeMs,
        finalTimeMs: entry.finalTimeMs,
        penalty: entry.penalty,
        falseStartDeltaMs: entry.falseStartDeltaMs,
        isDNF: false,
        rank,
        score: points,
      };
    });

    dnfSolves.forEach((entry) => {
      results[entry.playerId] = {
        playerId: entry.playerId,
        rawTimeMs: entry.rawTimeMs,
        finalTimeMs: Infinity,
        penalty: entry.penalty === 'NONE' && !entry.hasSolve ? 'DNF' : entry.penalty,
        falseStartDeltaMs: entry.falseStartDeltaMs,
        isDNF: true,
        rank: totalActive,
        score: 0,
      };
    });
  } else {
    // Differential scoring:
    // Fastest solver sets the baseline (Score = 0).
    // Subsequent players' scores = (Player Time - Fastest Time in seconds) * 100
    // Low score wins.
    // DNF yields differentialDNFScore (e.g. 5000 pts).
    const fastestTimeMs = validSolves.length > 0 ? validSolves[0].finalTimeMs : 0;

    validSolves.forEach((entry, idx) => {
      const rank = idx + 1;
      const deltaSeconds = (entry.finalTimeMs - fastestTimeMs) / 1000;
      const score = Math.round(deltaSeconds * 100);

      results[entry.playerId] = {
        playerId: entry.playerId,
        rawTimeMs: entry.rawTimeMs,
        finalTimeMs: entry.finalTimeMs,
        penalty: entry.penalty,
        falseStartDeltaMs: entry.falseStartDeltaMs,
        isDNF: false,
        rank,
        score,
      };
    });

    dnfSolves.forEach((entry) => {
      results[entry.playerId] = {
        playerId: entry.playerId,
        rawTimeMs: entry.rawTimeMs,
        finalTimeMs: Infinity,
        penalty: entry.penalty === 'NONE' && !entry.hasSolve ? 'DNF' : entry.penalty,
        falseStartDeltaMs: entry.falseStartDeltaMs,
        isDNF: true,
        rank: totalActive,
        score: settings.differentialDNFScore ?? 300,
      };
    });
  }

  return results;
}
