# @spatial-ui-kit/gesture-react

## Purpose

React glue that brings together:
- A `<video>` element for webcam input.
- A `<canvas>` overlay for cursor/debug visualization.
- A HandModel (from handtracking-tfjs).
- A GestureEngine (from gesture-core).

…and forwards ViewportCommands back to the app.

## Public API (v1)

```ts
import { ViewportCommand } from "@spatial-ui-kit/control-core";
import { HandModel } from "@spatial-ui-kit/handtracking-tfjs";

export type GestureError =
  | { type: "webcam-permission-denied" }
  | { type: "no-webcam" }
  | { type: "model-init-failed"; error: unknown };

export interface UseGestureControlOptions {
  model: HandModel | null; // pass null until ready
  onCommand: (cmd: ViewportCommand) => void; // receives PAN/ROTATE/ZOOM/POINTER_CLICK
  mapCursorToViewport?: (cursor: { x: number; y: number }) => {
    x: number;
    y: number;
  }; // optional remap from hand/video space -> viewport space
  fps?: number; // optional: limit detection FPS
  debug?: boolean; // draw extra info on overlay
  onError?: (err: GestureError) => void; // optional surfacing instead of console.error
}

export interface UseGestureControlResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
}

export function useGestureControl(
  options: UseGestureControlOptions
): UseGestureControlResult;
```

## Behavior & Data Flow

1) Lifecycle
- On mount, attach refs but do not start the webcam until `model` is non‑null.
- When `model` flips null → non‑null:
  - Request webcam via getUserMedia({ video: true }); if permission is denied or no device is present, surface `onError` (if provided) then log and bail.
  - Attach stream to videoRef.current.
  - Start a render loop (via requestAnimationFrame or interval based on fps).
- On unmount or when `model` becomes null: stop stream, cancel loop, clear overlay.

2) Per frame
- If model and videoRef.current are ready:
  - model.estimateHands(video) → TrackedHand[].
  - Wrap in HandFrame with timestamp.
  - Feed into GestureEngine.update(frame) → ViewportCommand[].
  - Map cursor space:
    - rawCursor = gestureEngine.getCursor() in hand/video `[0,1]` space.
    - cursor = mapCursorToViewport ? mapCursorToViewport(rawCursor) : rawCursor.
  - For each command:
    - If cmd.type === "POINTER_CLICK", emit onCommand({ ...cmd, xNorm: cursor.x, yNorm: cursor.y }) so clicks use mapped coords.
    - Otherwise, emit onCommand(cmd).
  - Downstream consumers can assume POINTER_CLICK values are already viewport-normalized (avoid remapping twice).
  - Draw overlay using the mapped cursor:
    - Clear canvas.
    - Draw cursor circle at `cursor` (normalized → pixels).
    - Optionally draw debug info (mode, hands, landmarks) if debug true.

3) Refs
- videoRef: you place this `<video>` anywhere (usually hidden or small).
- overlayRef: full-screen or parent-sized `<canvas>` layered on top of your 3D scene (pointer-events: none).

## Error handling (v0)
- If webcam permission is denied, no webcam exists, or model init fails:
  - Emit `onError` with `GestureError` if provided, then `console.error` as a fallback.
  - Leave gestures disabled (app keeps running).
- Expose a simple `enabled` flag or allow `model: null` so callers can disable gestures gracefully; the hook should tear down streams on disable.

## Internal Structure

```
packages/gesture-react/src/
  index.ts
  useGestureControl.ts
  HandTrackerLoop.ts  # manages RAF/timing
  OverlayDrawer.ts    # draws cursor + debug on canvas
```

## Extensibility

- Options:
  - fps to trade off CPU vs responsiveness.
  - debug to render landmarks/mode text.
- In future:
  - Additional hooks, e.g. useGestureCursor if someone wants to use cursor without viewport commands.
  - Custom overlay drawing callbacks.
