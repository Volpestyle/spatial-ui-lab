# Gesture Debug Mode Plan (Graph Sandbox)

Purpose: add a debugging view so we can see webcam input, landmarks, gesture engine state, and emitted commands in the sandbox.

## Goals
- Show live video + overlay with cursor and hand landmarks (left/right colored).
- Display gesture engine state (mode, primaryHand), model status, detected hand count.
- Log recent `ViewportCommand`s (ROTATE/PAN/ZOOM/POINTER_CLICK) with values and timestamps.
- Provide toggles to enable/disable debug drawing without affecting normal gesture operation.

## UI & Layout
- HUD controls:
  - Existing “Enable gestures” toggle.
  - Add “Show gesture debug” toggle.
  - Status badges: model load state, detected hands, last error (if any).
- Debug panel (shown when toggle is on):
  - Video element (larger, visible).
  - Overlay canvas (draw cursor + landmarks + mode text).
  - Command log list (last N commands).
  - Metrics: FPS of gesture loop, inference time, mode/primaryHand.

## Data & Instrumentation
- Extend gesture loop (useGestureControl consumer) to collect per-frame info when debug is on:
  - `hands`: tracked hands from model.
  - `cursor`: raw + mapped.
  - `debugState`: mode, primaryHand.
  - Timing: start/end of estimateHands + update.
  - Commands emitted.
- Maintain a ring buffer of recent commands (e.g., last 25).
- Skip extra drawing/work when debug is off to avoid overhead.

## Overlay Drawing
- Reuse `overlayRef` canvas:
  - Clear and draw cursor.
  - For each hand: draw landmarks as small circles; connect index chain; color code Left/Right.
  - Draw text: `mode (primaryHand)` in a corner.
- Resize canvas to client size each frame when debug on.

## Error/Status Surfacing
- Use existing `onError` to capture webcam/model errors; show in HUD/debug panel.
- Show model status: idle/loading/ready/error.
- Show detected hand count per frame.

## Implementation Steps
1) Add debug toggle + state to sandbox HUD.
2) Enhance gesture loop in `apps/graph-sandbox/src/main.tsx` (or via a small helper hook) to capture per-frame data when debug is true.
3) Implement overlay drawing for landmarks/cursor/mode when debug is true; keep cursor-only when false.
4) Add command log ring buffer and render it in the debug panel.
5) Wire status badges (model state, hand count, last error).
6) Manual verification: toggle debug on/off while gestures enabled; confirm landmarks/commands update; no console errors.

## Optional Extras
- “Reset gestures” button to clear logs and controller state.
- Color legend for hands; show pinch flags next to each hand entry.
