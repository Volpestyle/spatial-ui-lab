# @spatial-ui-kit/gesture-core – hand → commands

Goal v0: GestureEngine implementing the gesture set and emitting `ViewportCommand[]`.

- Create package skeleton
  - packages/gesture-core/package.json
  - src/index.ts
  - src/types.ts
  - src/GestureEngine.ts
  - src/internals/geometry.ts
  - src/internals/state.ts
- Define landmark types in types.ts
  - Landmark, TrackedHand, HandFrame, Handedness
  - GestureEngineOptions
- Implement geometry helpers
  - dist2D(a,b)
  - handCenter(hand)
  - isFingerExtended(hand, tip,pip,mcp)
- Implement GestureEngine
  - Store per-hand state (pinch flags, centers, tap timing)
  - Store global mode: "IDLE" | "ROTATE" | "PAN" | "ZOOM" | "CURSOR"
  - update(frame) pipeline:
    - Update pinches & hand centers
    - Detect two-hand pinch → ZOOM mode and emit ZOOM
    - Else, for primary hand:
      - If open-point → update cursor, detect tap → POINTER_CLICK
      - Else if double pinch → PAN
      - Else if single pinch → ROTATE
    - Use thresholds and simple hysteresis
  - getCursor() returns last cursor pos
  - getDebugState() returns mode/hand info
- Tests (logic-level)
  - Simulate simple sequences of HandFrames to assert expected commands:
    - Single pinch drag → emits ROTATE
    - Double pinch drag → emits PAN
    - Two-hand pinch stretch → emits ZOOM
    - Open point + quick tap → emits POINTER_CLICK
- Export from index.ts
