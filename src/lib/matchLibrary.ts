// src/lib/matchLibrary.ts
// Stub for match persistence to Firestore.
// TODO: Implement full match saving logic.

import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { SetMatch, Player, TournamentSettings, TeamId } from '@/types/tournament';

export async function saveMatch(
  userId: string,
  matchId: string,
  sets: SetMatch[],
  players: Player[],
  matchWinnerPlayerId: string | null,
  matchWinnerTeamId: TeamId | null,
  settings: TournamentSettings
): Promise<void> {
  try {
    const matchRef = doc(db, 'users', userId, 'matches', matchId);
    await setDoc(matchRef, {
      matchId,
      sets: JSON.parse(JSON.stringify(sets)),
      players: JSON.parse(JSON.stringify(players)),
      matchWinnerPlayerId,
      matchWinnerTeamId,
      settings: JSON.parse(JSON.stringify(settings)),
      completedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to save match to Firestore:', err);
  }
}
