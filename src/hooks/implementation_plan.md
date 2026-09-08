# Implementation Plan

## Goal
Create a reusable hook `useKeyboardController` that registers global keyboard listeners to drive the timer state machine and integrates with the existing **timerStore** and **tournamentStore**.

## Steps
1. **Identify Store API**
   - `useTimerStore` provides state (`raceState`) and actions (`startCountdown`, `hold`, `releaseHold`, `finishRace`, `reset`, `setRaceState`).
   - `RaceState` enum enumerates the possible states.
   - `useTournamentStore` is imported for side‑effects / future extensions.
2. **Determine Shortcut Behaviour**
   - **Spacebar** – start countdown when idle, treat press during countdown as false‑start (reset), finish race when running, release hold when paused.
   - **`h` / `H`** – manual hold while running, release on key‑up.
   - **Escape** – abort and reset to idle.
   - Ignore input when focus is on an editable element.
3. **Create Hook Skeleton**
   - Import `useEffect`, `useCallback` from React.
   - Pull required state and actions from the stores.
   - Utility `isTextInputElement` to filter out text inputs.
4. **Implement Handlers**
   - `handleKeyDown` implements the logic above, using a `switch` on `raceState`.
   - `handleKeyUp` releases a hold when the `h` key is lifted.
5. **Register / Cleanup Listeners**
   - Use `useEffect` to add listeners on mount and remove them on unmount.
6. **Return Minimal Public API**
   - Return `{ raceState, scoring }` so components can read the current race state and tournament scoring mode if needed.
7. **Create File**
   - Path: `src/hooks/useKeyboardController.ts`.
   - Export the hook.

## Testing & Validation
- Ensure the hook compiles (TypeScript types match).
- Verify that pressing space while the timer is idle triggers `startCountdown`.
- Verify false‑start handling (press during countdown resets).
- Verify hold/release with `h` key.
- Verify Escape resets the timer.
- Confirm listeners are removed on component unmount.

---
*This plan will be saved as `implementation_plan.md`.*
