# Walkthrough

## Overview
The new **`tournamentStore`** is a Zustand store that centralises all tournament‑related state and actions. It lives in `src/store/tournamentStore.ts` and is ready to be imported anywhere in the React codebase.

---
## Key Concepts
| Concept | Detail |
|---|---|
| **Match lifecycle** | `MatchStatus` enum – `NotStarted`, `InProgress`, `Completed`. |
| **Scoring** | `ScoreType` enum – `Rank` (points based on player ranking) or `Differential` (sum of set scores). |
| **Data structures** | `Player` (id, name, rank, score) and `Match` (ids, status, optional winner, `setScores`). |
| **Store shape** | `TournamentState` – players, matches, current round, scoring mode, admin modal flag, and actions. |
| **UI state** | `adminModalOpen` toggles the admin modal used in the arena UI. |

---
## How to Use
```tsx
import useTournamentStore from '@/store/tournamentStore';

// Adding a player
useTournamentStore.getState().addPlayer({
  id: 'p1',
  name: 'Alice',
  rank: 1,
});

// Creating a match
useTournamentStore.getState().createMatch('m1', 'p1', 'p2');
useTournamentStore.getState().startMatch('m1');

// Record each set's points (e.g., 11‑9, 7‑11, 11‑5)
useTournamentStore.getState().recordSetScore('m1', 11);
useTournamentStore.getState().recordSetScore('m1', 9);
// ...

// Finish the match – winner receives points according to the active scoring type
useTournamentStore.getState().finishMatch('m1', 'p1');

// Advance to the next round
useTournamentStore.getState().nextRound();

// UI helper – toggle the admin modal
useTournamentStore.getState().toggleAdminModal();

// Change scoring system on‑the‑fly
useTournamentStore.getState().setScoring(ScoreType.Differential);
```

---
## Internals
1. **Scoring helpers**
   - `calculateRankPoints` → `totalPlayers - winnerRank + 1`.
   - `calculateDifferentialPoints` → `match.setScores.reduce((a,b)=>a+b,0)`.
2. **State updates** – All actions use the functional `set` provided by Zustand, ensuring immutable updates.
3. **Extensibility** – The store can be expanded with additional match‑level data (games, tie‑breakers) without breaking existing API.

---
## Next Steps
- Import the store wherever tournament data is needed (e.g., the arena UI components).
- Wire UI components (player list, match board, admin modal) to the store via selectors: `const players = useTournamentStore(state => state.players);`
- Write unit tests to validate scoring calculations.

---
**Artifacts**
- Implementation plan: [implementation_plan.md](file:///Users/christiancutter/Developer/cube-online/implementation_plan.md)
- Store source: [tournamentStore.ts](file:///Users/christiancutter/Developer/cube-online/src/store/tournamentStore.ts)
- This walkthrough: [walkthrough.md](file:///Users/christiancutter/Developer/cube-online/walkthrough.md)
