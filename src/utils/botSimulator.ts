import type { BotConfig, BotMaturity, PenaltyType } from '@/types/tournament';
import { BotMaturity as BotMaturityConstants, PenaltyType as PenaltyTypeConstants } from '@/types/tournament';

/**
 * Standard Box-Muller transform for generating normally distributed values
 */
function sampleGaussian(mean: number, stdDev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

/**
 * Bot penalty and error probabilities based on maturity
 */
const MATURITY_PROBABILITIES: Record<
  BotMaturity,
  { falseStartRate: number; plus2Rate: number; dnfRate: number; maxFalseStartDeltaMs: number }
> = {
  [BotMaturityConstants.NOVICE]: {
    falseStartRate: 0.08,
    plus2Rate: 0.12,
    dnfRate: 0.03,
    maxFalseStartDeltaMs: 400,
  },
  [BotMaturityConstants.INTERMEDIATE]: {
    falseStartRate: 0.04,
    plus2Rate: 0.06,
    dnfRate: 0.015,
    maxFalseStartDeltaMs: 250,
  },
  [BotMaturityConstants.PRO]: {
    falseStartRate: 0.01,
    plus2Rate: 0.02,
    dnfRate: 0.005,
    maxFalseStartDeltaMs: 120,
  },
  [BotMaturityConstants.WORLD_CLASS]: {
    falseStartRate: 0.0,
    plus2Rate: 0.005,
    dnfRate: 0.001,
    maxFalseStartDeltaMs: 50,
  },
};

export interface SimulatedBotSolve {
  targetSolveTimeMs: number;
  penalty: PenaltyType;
  falseStartDeltaMs: number;
}

/**
 * Generate a simulated solve for a bot based on its stats and maturity
 */
export function generateBotSolve(config: BotConfig): SimulatedBotSolve {
  const { averageTimeMs, stdDevMs, maturity, maturityNumber } = config;
  
  let probs = MATURITY_PROBABILITIES[maturity] || MATURITY_PROBABILITIES[BotMaturityConstants.INTERMEDIATE];
  
  if (maturityNumber !== undefined) {
    probs = {
      falseStartRate: maturityNumber * 0.4,
      plus2Rate: maturityNumber * 0.5,
      dnfRate: maturityNumber * 0.1,
      maxFalseStartDeltaMs: 250, // Keep a constant false start delay range
    };
  }

  // 1. Generate Gaussian solve time (clamped to realistic minimum)
  const rawSample = sampleGaussian(averageTimeMs, stdDevMs);
  const targetSolveTimeMs = Math.max(500, Math.round(rawSample));

  // 2. Check for penalties
  let penalty: PenaltyType = PenaltyTypeConstants.NONE;
  const randPenalty = Math.random();
  if (randPenalty < probs.dnfRate) {
    penalty = PenaltyTypeConstants.DNF;
  } else if (randPenalty < probs.dnfRate + probs.plus2Rate) {
    penalty = PenaltyTypeConstants.PLUS_2;
  }

  return {
    targetSolveTimeMs,
    penalty,
    falseStartDeltaMs: 0,
  };
}

/**
 * Generate a random ready-up delay for bots (always < 3 seconds, realistic human reaction)
 */
export function generateBotReadyDelay(): number {
  // Between 350ms and 2400ms
  return Math.round(350 + Math.random() * 2050);
}
