import { randomScrambleForEvent } from 'cubing/scramble';

export interface WCAEventInfo {
  code: string;
  name: string;
  shortName: string;
  iconHint: string;
}

export const WCA_EVENTS: WCAEventInfo[] = [
  { code: '333', name: '3x3x3 Cube', shortName: '3x3', iconHint: '🎲' },
  { code: '222', name: '2x2x2 Cube', shortName: '2x2', iconHint: '🧊' },
  { code: '444', name: '4x4x4 Cube', shortName: '4x4', iconHint: '⬛' },
  { code: '555', name: '5x5x5 Cube', shortName: '5x5', iconHint: '◼️' },
  { code: '666', name: '6x6x6 Cube', shortName: '6x6', iconHint: '◾' },
  { code: '777', name: '7x7x7 Cube', shortName: '7x7', iconHint: '▫️' },
  { code: 'pyram', name: 'Pyraminx', shortName: 'Pyra', iconHint: '🔺' },
  { code: 'skewb', name: 'Skewb', shortName: 'Skewb', iconHint: '💎' },
  { code: 'clock', name: 'Clock', shortName: 'Clock', iconHint: '⏰' },
  { code: 'minx', name: 'Megaminx', shortName: 'Mega', iconHint: '⭐' },
  { code: 'sq1', name: 'Square-1', shortName: 'Sq-1', iconHint: '🔷' },
];

export async function generateScramble(eventType: string = '333'): Promise<string> {
  try {
    const scramble = await randomScrambleForEvent(eventType);
    return scramble.toString();
  } catch (error) {
    console.error('Failed to generate scramble:', error);
    // Safe standard fallback
    if (eventType === '222') return "R U' R2 U' F R' F U2 F'";
    if (eventType === 'pyram') return "U B' R L' B R' l' r b";
    return "R U R' U' R' F R2 U' R' U' R U R' F'";
  }
}

export const generateWcaScramble = generateScramble;
