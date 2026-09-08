# Implementation Plan

## Goal
Create a Zustand store (`src/store/tournamentStore.ts`) that manages tournament state, including:
- Match lifecycle (`MatchStatus`).
- Scoring types (`ScoreType`).
- Player data and match data structures.
- Rank‑based and differential scoring logic.
- Set/Game/Round progression.
- Admin modal UI state.
- Exposed actions for the arena UI.

## Steps
1. **Explore repo layout** – Locate `src` directory, ensure a `store` folder exists (or create one).
2. **Define enums** – `MatchStatus` (NotStarted, InProgress, Completed) and `ScoreType` (Rank, Differential).
3. **Define interfaces** – `Player` (id, name, rank, score) and `Match` (ids, status, optional winner, setScores).
4. **Design store shape** – `TournamentState` containing core data (`players`, `matches`, `currentRound`, `scoring`) and UI state (`adminModalOpen`).
5. **Implement scoring helpers** –
   - `calculateRankPoints` uses total players and winner rank.
   - `calculateDifferentialPoints` sums set scores.
6. **Create Zustand store** using `create<TournamentState>`:
   - Initialise empty collections, round 1, default scoring, modal closed.
   - Provide actions: `addPlayer`, `removePlayer`, `createMatch`, `startMatch`, `recordSetScore`, `finishMatch`, `nextRound`, `toggleAdminModal`, `setScoring`.
   - In `finishMatch`, compute points based on selected `ScoreType` and update winner’s score.
7. **Export store** – default export `useTournamentStore` for consumption.
8. **Add file to repository** – write to `src/store/tournamentStore.ts`.
9. **Create documentation artifacts** – `implementation_plan.md` (this file) and `walkthrough.md` describing the code and usage.

## Validation
- Verify TypeScript compiles (`npm run build` or `tsc`).
- Import the store in a component and ensure actions update state correctly.
- Run a quick manual test by adding players, creating a match, recording scores, finishing match, and toggling the admin modal.

---
**Artifacts generated:**
- `implementation_plan.md`
- `walkthrough.md`
- `src/store/tournamentStore.ts` (implemented in previous step)
