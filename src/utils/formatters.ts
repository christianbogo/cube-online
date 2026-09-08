import type { PenaltyType, ScoringMode } from '@/types/tournament';

/**
 * Format milliseconds into standard speedcubing timer display (e.g. 9.42, 1:04.12, DNF)
 */
export function formatTime(
  timeMs: number | null | undefined,
  options: {
    showHundredths?: boolean;
    penalty?: PenaltyType;
    showSign?: boolean;
  } = {}
): string {
  const { penalty = 'NONE', showSign = false } = options;

  if (penalty === 'DNF') {
    return 'DNF';
  }

  if (timeMs === null || timeMs === undefined || isNaN(timeMs) || timeMs < 0) {
    return '--.--';
  }

  const sign = showSign && timeMs > 0 ? '+' : '';
  const totalSeconds = timeMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((timeMs % 1000) / 10);

  const hundredthsStr = hundredths.toString().padStart(2, '0');

  if (minutes > 0) {
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}.${hundredthsStr}`;
  } else {
    return `${sign}${seconds}.${hundredthsStr}`;
  }
}

/**
 * Format points for display
 */
export function formatPoints(points: number, mode: ScoringMode): string {
  if (points === undefined || points === null || isNaN(points)) {
    return '0';
  }
  if (mode === 'DIFFERENTIAL') {
    return `+${points.toFixed(0)} pts`;
  }
  return `${points} pts`;
}

/**
 * Format key label for display (e.g. ';' -> ';')
 */
export function formatKeyLabel(key: string): string {
  return key.toUpperCase();
}
