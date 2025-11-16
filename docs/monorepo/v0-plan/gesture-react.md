# @spatial-ui-kit/gesture-react – React hook wiring

Goal v0: Working `useGestureControl` hook that drives commands + overlay.

- Create package skeleton
  - packages/gesture-react/package.json
  - src/index.ts
  - src/useGestureControl.ts
  - src/OverlayDrawer.ts
- Define UseGestureControlOptions + result
  - model: HandModel | null
  - onCommand(cmd: ViewportCommand)
  - Optional fps, debug
  - Returns { videoRef, overlayRef }
- Implement OverlayDrawer
  - Draw cursor circle at normalized (x,y) on canvas
  - Resize canvas to match DOM size
  - Optionally draw debug text (mode/hand) when debug true
- Implement useGestureControl
  - Create videoRef, overlayRef
  - On model ready:
    - Request webcam and attach stream to videoRef
    - Instantiate GestureEngine
    - Start loop (via requestAnimationFrame or setInterval based on fps)
  - If video + model ready:
    - Call model.estimateHands(video)
    - Create HandFrame with timestamp
    - Call GestureEngine.update(frame) → commands
    - For each command, call onCommand(cmd)
    - Draw overlay with OverlayDrawer
  - On cleanup:
    - Stop webcam tracks
    - Cancel loop
- Minimal tests
  - Type-level tests that hook compiles
  - Manual test in sandbox app (gestures move camera)
