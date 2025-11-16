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

export interface UseGestureControlOptions {
  model: HandModel | null; // pass null until ready
  onCommand: (cmd: ViewportCommand) => void; // receives PAN/ROTATE/ZOOM/POINTER_CLICK
  fps?: number; // optional: limit detection FPS
  debug?: boolean; // draw extra info on overlay
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
- On mount (and whenever model changes from null → non‑null):
  - Request webcam via getUserMedia({ video: true }).
  - Attach stream to videoRef.current.
  - Start a render loop (via requestAnimationFrame or interval based on fps).
- On unmount or model change: stop stream, cancel loop.

2) Per frame
- If model and videoRef.current are ready:
  - model.estimateHands(video) → TrackedHand[].
  - Wrap in HandFrame with timestamp.
  - Feed into GestureEngine.update(frame) → ViewportCommand[].
  - For each command, call onCommand(cmd).
  - Draw overlay:
    - Clear canvas.
    - Draw cursor circle at engine.getCursor() (normalized → pixels).
    - Optionally draw debug info (mode, hands, landmarks) if debug true.

3) Refs
- videoRef: you place this `<video>` anywhere (usually hidden or small).
- overlayRef: full-screen or parent-sized `<canvas>` layered on top of your 3D scene (pointer-events: none).

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
