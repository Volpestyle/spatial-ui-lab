# @spatial-ui-kit/gesture-core

## Purpose

A gesture engine that converts hand skeletons (21 landmarks per hand) into ViewportCommands and a cursor position. No browser, no webcam, no React—just math + state machine.

## Public API (v1)

```ts
// types.ts
export type Handedness = "Left" | "Right";

export interface Landmark {
  x: number; // [0,1] in image space, left→right
  y: number; // [0,1], top→bottom
  z?: number;
}

export interface TrackedHand {
  handedness: Handedness;
  landmarks: Landmark[]; // 21 points, MediaPipe ordering
}

export interface HandFrame {
  hands: TrackedHand[];
  timestamp: number; // ms, e.g. performance.now()
}

export interface GestureEngineOptions {
  tapMaxDurationMs?: number;
  pinchIndexThreshold?: number;
  pinchMiddleThreshold?: number;
  rotationSensitivity?: number;
  panSensitivity?: number;
  zoomSensitivity?: number;
  // Advanced smoothing/tuning knobs (optional)
  moveDeadzone?: number;
  zoomDeadzone?: number;
}

// GestureEngine.ts
import { ViewportCommand } from "@spatial-ui-kit/control-core";

export class GestureEngine {
  constructor(opts?: GestureEngineOptions);

  // Main entrypoint: process one frame and emit 0..n commands
  update(frame: HandFrame): ViewportCommand[];

  // Current cursor position, normalized [0,1]
  getCursor(): { x: number; y: number };

  // (Optional) debug info (mode, active hand, etc.)
  getDebugState(): {
    mode: "IDLE" | "ROTATE" | "PAN" | "ZOOM" | "CURSOR";
    primaryHand?: Handedness;
  };
}
```

`GestureEngineOptions` covers the core thresholds/sensitivities and a couple of advanced smoothing knobs (move/zoom deadzones). Treat the deadzones as optional tuning parameters; defaults should be set so callers can ignore them.

### Default values (v0)
- `tapMaxDurationMs`: 220
- `pinchIndexThreshold`: 0.06
- `pinchMiddleThreshold`: 0.07
- `rotationSensitivity`: 200
- `panSensitivity`: 100
- `zoomSensitivity`: 5
- `moveDeadzone`: 0.0015
- `zoomDeadzone`: 0.001

## Gesture Semantics (v1)

Using MediaPipe Hands landmark ordering:
- Rotate: active when one hand with thumb–index pinch detected, middle not pinched. Movement of hand center → emit ROTATE { dx, dy }.
- Pan: active when one hand with thumb–index and thumb–middle both close (“double pinch”). Movement of hand center → emit PAN { dx, dy }.
- Zoom: active when both hands in thumb–index pinch state. Change in distance between hand centers → emit ZOOM { delta }.
- Cursor + click:
  - “Open point” when index extended, other fingers curled (and not pinched).
  - Cursor: index fingertip mapped to [0,1].
  - Quick pinch-tap (thumb–index pinch start/end under tapMaxDurationMs) → emit POINTER_CLICK { xNorm, yNorm }.

Internally uses a mode state machine:

```
IDLE
 -> ROTATE (single pinch)
 -> PAN (double pinch)
 -> ZOOM (two-hand pinch)
 -> CURSOR (open point)

ZOOM has priority over others if both hands pinched.
```

## Internal Structure

```
packages/gesture-core/src/
  index.ts
  types.ts
  GestureEngine.ts
  internals/
    geometry.ts  # distance, angle, “is finger extended?” helpers
    state.ts     # per-hand tracking state
    modes.ts     # logic for ROTATE/PAN/ZOOM/CURSOR transitions
```

## Extensibility

- Custom gesture presets via GestureEngineOptions (sensitivity, thresholds).
- Future: alternative engines (e.g. SimpleGestureEngine, VRGestureEngine).

## Implementation notes
- Tap detection should track “pinch just released” separately from clearing pinch state. If you clear `pinchActive`/`pinchStartTime` before the click detector runs, a quick pinch-and-release will be invisible to the tap logic. Store `pinchStartTime` and a `pinchJustReleasedAt` timestamp so the click check can compare release time to tapMaxDurationMs before resetting state.
