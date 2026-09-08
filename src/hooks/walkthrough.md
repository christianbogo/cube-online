# Walkthrough

## Overview
`useKeyboardController` is a small, self‑contained React hook that:
1. **Registers global keyboard listeners** (`keydown` / `keyup`).
2. **Controls the timer state machine** defined in `src/store/timerStore.ts`.
3. **Integrates with the tournament store** (`src/store/tournamentStore.ts`) – currently only exposing the `scoring` value, but the hook can be expanded to record race outcomes.
4. **Cleans up** the listeners when the component using the hook unmounts.

## How It Works
| Key | When `raceState` is… | Action | Reason |
|-----|----------------------|--------|--------|
| **Space** | `Idle` | `startCountdown()` | Begins pre‑race countdown (default 3 s). |
|           | `Countdown` | `reset()` | False‑start – a press during the countdown aborts the race. |
|           | `Running` | `finishRace()` | Completes the race (final state `Finished`). |
|           | `Paused` | `releaseHold()` | Ends a hold that was active. |
| **h / H** | `Running` | `hold()` (on key‑down) and `releaseHold()` (on key‑up) | Manual pause for the active player. |
| **Escape** | *any* | `reset()` | Returns everything to `Idle` and clears timers. |

The hook first checks whether the event originated from a text‑input element (`<input>`, `<textarea>`, or a content‑editable element). If so, the shortcuts are ignored – this mirrors the behaviour already present in `pages/Cube.tsx`.

## Public API
```ts
export function useKeyboardController(): {
  raceState: RaceState; // current timer state for UI consumption
  scoring: ScoreType;   // tournament scoring mode (read‑only)
}
```
Components can simply call the hook to activate the listeners and optionally read `raceState` to render UI (e.g., a timer display) without having to manage the listeners themselves.

## Where to Use It
Import and invoke the hook in any component that should respond to the global shortcuts – the main timer page (`pages/Cube.tsx`) is the natural place:
```tsx
import { useKeyboardController } from '../hooks/useKeyboardController';

function CubePage() {
  const { raceState } = useKeyboardController();
  // ...existing logic
}
```
Because the hook registers listeners on `window`, it works regardless of the component hierarchy.

## Testing Checklist
- ✅ Space starts countdown from idle.
- ✅ Space during countdown triggers reset (false‑start).
- ✅ Space while running finishes the race.
- ✅ `h` holds during running and releases on key‑up.
- ✅ Escape resets to idle.
- ✅ Listeners are removed when the component unmounts (no memory leaks).
- ✅ Input fields (e.g., chat, settings) do not capture shortcuts.

---
*This walkthrough is saved as `walkthrough.md`.*
