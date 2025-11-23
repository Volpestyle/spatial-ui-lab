# Gesture Definitions

Webcam → hand landmarks → gesture state machine → `ViewportCommand` events → 3D node UI. Here is how to implement that cleanly in the browser.

> This tutorial mirrors the canonical APIs in the monorepo design specs; use the package types as your source of truth (see `docs/types-index.md`) and treat this as illustrative glue.

---

## 1. High-Level Pipeline
1. Capture webcam video with `getUserMedia`.
2. Run a hand-tracking model on each frame (MediaPipe Hands / Hand Landmarker or TF.js hand-pose-detection). You get 21 keypoints per hand with handedness.
3. From keypoints, compute:
   - Finger states (extended, curled, pinched)
   - Hand center and motion
   - Distances between thumb ↔ index, thumb ↔ middle, etc.
4. Feed that into a gesture state machine that recognizes:
   - Single-hand single pinch drag → rotate
   - Double-hand pinch in/out → zoom
   - Single-hand double pinch drag → pan
   - Open-point + pinch tap → cursor + click
5. Emit abstract commands to the viewport controller:
   - `ROTATE { dx, dy }`
   - `PAN { dx, dy }`
   - `ZOOM { delta }`
   - `POINTER_CLICK { xNorm, yNorm }`
   - Continuous cursor data is exposed separately via `GestureEngine.getCursor()` instead of a `MOVE_CURSOR` command.

---

## 2. Hand Tracking on the Web
### Library options
- **MediaPipe Hand Landmarker / Gesture Recognizer (web JS)**: Part of Google’s AI Edge / MediaPipe Tasks; provides landmarks plus handedness.
- **TensorFlow.js `@tensorflow-models/hand-pose-detection` (MediaPipe backend)**: TF.js wrapper around the same models, optimized for the browser.

### Basic setup flow
- Add a `<video>` element (hidden or tiny) and a `<canvas>` overlay for debugging if desired.
- Call `navigator.mediaDevices.getUserMedia({ video: true })` and stream into the video.
- Initialize the hand model (MediaPipe or TF.js).
- Every animation frame:
  - Grab the current video frame.
  - Call `detectForVideo` / `estimateHands`.
  - Receive `hands[]`, each with 21 landmarks and handedness.

## 2.5 Coordinate spaces & cursor mapping
- Hand landmark coordinates are normalized `[0,1]` with `(0,0)` at the top-left of the captured video. Gesture-core keeps its cursor in this “raw” space.
- `ViewportCommand.POINTER_CLICK` always reports `{ xNorm, yNorm }` in `[0,1]`. Each renderer converts those normalized coords to its own system (e.g., Three.js NDC) locally:

```ts
const ndcX = xNorm * 2 - 1;
const ndcY = -(yNorm * 2 - 1);
raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
```

- When the webcam feed and the interactive canvas have different aspect ratios (or the app has multiple sub-viewports), add an optional mapping layer in React:

```ts
useGestureControl({
  model,
  onCommand,
  mapCursorToViewport: ({ x, y }) => warpHandSpaceIntoViewport(x, y),
});
```

Coordinate cheat sheet:

| Name            | Range  | Origin    | Used by                          |
| --------------- | ------ | --------- | -------------------------------- |
| Hand/video      | [0,1]  | Top-left  | gesture-core / HandModel         |
| Viewport-normal | [0,1]  | Top-left  | gesture-react → app              |
| WebGL NDC       | [-1,1] | Center, Y flipped | graph-three raycasting     |

`gesture-react` applies `mapCursorToViewport` before drawing the overlay or emitting POINTER_CLICK, so downstream consumers always receive viewport-normalized coordinates (do not remap clicks again).

---

## 3. Gesture Definitions
### Common primitives
Landmarks are normalized to `[0,1]` image space.

```ts
function dist2D(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function handCenter(hand: { landmarks: { x: number; y: number }[] }) {
  const ids = [0, 5, 9, 13, 17]; // wrist + MCP joints
  let x = 0;
  let y = 0;
  for (const i of ids) {
    x += hand.landmarks[i].x;
    y += hand.landmarks[i].y;
  }
  return { x: x / ids.length, y: y / ids.length };
}
```

Maintain a short history per hand (last N frames) for smoothing.

### Rotate: single-hand single pinch drag
Definition: thumb + index pinch while middle finger is not pinched; hand movement rotates the graph.

Detection steps:
1. Detect pinch (thumb–index) with a threshold (e.g., `0.06`).
2. Ensure middle finger is not pinched.
3. When pinch transitions false → true, enter ROTATE mode for that hand.
4. While in ROTATE, track `handCenter` delta frame to frame; smooth with EMA:

```ts
rotDX = alpha * dx + (1 - alpha) * rotDX;
rotDY = alpha * dy + (1 - alpha) * rotDY;
commands.push({ type: "ROTATE", dx: rotDX * sensitivityX, dy: rotDY * sensitivityY });
```

### Zoom: double-hand pinch in/out
Definition: both hands pinched at the same time; distance change between hands drives zoom.

Detection steps:
1. Require two hands; both must be pinched.
2. On entry, record base distance between `handCenter` values.
3. Each frame in ZOOM mode: `delta = currDist - baseDist`; emit `ZOOM(delta * sensitivity)`.
4. Exit when either hand leaves pinch state.

### Pan: single-hand double pinch drag
Definition: thumb touching both index and middle (both close) and hand movement pans.

Detection steps:
1. Detect `pinchIndex` and `pinchMiddle`; both true → DOUBLE PINCH.
2. When DOUBLE PINCH starts (and not already rotating/zooming), enter PAN mode.
3. In PAN: use `handCenter` deltas with smoothing; emit `PAN(dx * sensitivityX, dy * sensitivityY)`.
4. Exit when double pinch releases for N frames. Give double pinch higher priority than single pinch to avoid flicker.

### Cursor + click: open point + pinch tap
Definition: open hand with only index extended moves a 2D cursor; a quick pinch tap becomes a pointer click.

Detecting the pose:
- Consider a finger extended if tip–PIP–MCP bones are nearly colinear.

```ts
function isFingerExtended(hand: TrackedHand, tipIndex: number, pipIndex: number, mcpIndex: number) {
  const tip = hand.landmarks[tipIndex];
  const pip = hand.landmarks[pipIndex];
  const mcp = hand.landmarks[mcpIndex];

  const v1x = tip.x - pip.x;
  const v1y = tip.y - pip.y;
  const v2x = pip.x - mcp.x;
  const v2y = pip.y - mcp.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);
  const cosTheta = dot / (mag1 * mag2 + 1e-6);
  return cosTheta > 0.7; // tune
}
```

Pose rules:
- `indexExtended` true, `middle/ring/pinky` false, and no pinch → OPEN POINT.
- Cursor position = index tip `(x, y)` mapped to canvas size, with smoothing.
- Quick thumb–index pinch while in OPEN POINT (duration < `TAP_MAX_DURATION`) → `ViewportCommand.POINTER_CLICK { xNorm, yNorm }`.
- `GestureEngine.getCursor()` (surfaced via `useGestureControl`) keeps the overlay in sync rather than emitting a `MOVE_CURSOR` command.

---

## 4. Glue Code and Architecture
### Components / modules
- **HandTracker**: wraps MediaPipe/TF.js; emits `HandFrame` (hands + timestamp).
- **GestureEngine**: consumes `HandFrame`, maintains per-hand state, emits `ViewportCommand[]`.
- **OrbitViewportController**: receives camera commands via `handle(command)` (PAN/ROTATE/ZOOM) and ignores clicks; the app forwards `POINTER_CLICK`s to its renderer of choice.

### Main loop (pseudo-code)
```ts
let lastFrameTime = performance.now();

async function onAnimationFrame(now: number) {
  const dt = now - lastFrameTime;
  lastFrameTime = now;

  const hands = await handTracker.estimateHands(video);
  const commands = gestureEngine.update({ hands, timestamp: now });

  for (const cmd of commands) {
    if (cmd.type === "POINTER_CLICK") {
      gestureClickRef.current = {
        xNorm: cmd.xNorm,
        yNorm: cmd.yNorm,
        token: ++clickToken,
      };
    } else {
      graphController.handle(cmd);
    }
  }

  requestAnimationFrame(onAnimationFrame);
}
```
- You can run the model at a lower rate (e.g., 15 fps) and interpolate between results.
- MediaPipe recommends offloading detection to a Web Worker for perf.
- Graph renderers (graph-three, etc.) convert `{ xNorm, yNorm }` to NDC before raycasting so mouse and gesture clicks share the same code path.

---

## 5. Making It Feel Good (jitter, false positives)
- Temporal smoothing with low-pass filters; add small deadzones.
- Hysteresis on thresholds (different start vs. end pinch distances, e.g., start `<0.06`, end `>0.08`).
- Mode priority: if double pinch is active, suppress single pinch; if zooming, ignore rotate/pan.
- Gesture enable/disable toggle (keyboard shortcut helps real use).
- Visual HUD showing current mode and pinch status for easier tuning.

---

## 6. Stack Suggestion (one concrete build path)
- 3D graph: React + `@react-three/fiber` + `three`.
- Hand tracking: MediaPipe Tasks Hand Landmarker or Gesture Recognizer (JS), or TF.js hand-pose-detection with the MediaPipe backend.
- Overlay and debug: canvas for cursor + gesture drawings (can be hidden later).

Once this is wired, your 3D graph does not care whether commands came from a mouse or webcam gestures.
