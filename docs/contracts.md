# Cross-Package Contracts

Single-page “law of the land” for how inputs, coordinates, and clicks are interpreted across the packages. These invariants should stay stable; update here first when behavior changes.

## ViewportCommand semantics
- `PAN.dx > 0` moves the content right; `PAN.dy > 0` moves content up.
- `ROTATE.dx > 0` rotates the view to the right; `ROTATE.dy > 0` rotates up.
- `ZOOM.delta > 0` zooms in (shrinks radius).
- `POINTER_CLICK.xNorm/yNorm` are normalized `[0,1]` with a top-left origin before they reach `graph-three`. `graph-three` is the only place that converts to NDC.

## Coordinate spaces
- Hand/video: normalized `[0,1]`, top-left origin (what `HandModel` + `gesture-core` work in).
- Viewport-normalized: normalized `[0,1]`, top-left origin (what `gesture-react` emits after applying `mapCursorToViewport`).
- WebGL NDC: `[-1,1]`, center origin with Y flipped (what `graph-three` raycasting uses).
- Renderers convert from viewport-normalized to their local space; emitters never assume pixel sizes.

## Click path
1) `gesture-core` emits `POINTER_CLICK` in hand/video space.  
2) `gesture-react` rewrites `xNorm/yNorm` using `mapCursorToViewport` (identity by default) and draws overlays using the mapped cursor.  
3) Apps pass the normalized click through unchanged (optionally tagging it with a token).  
4) `graph-three` converts `{ xNorm, yNorm }` → NDC internally and shares the raycast path with mouse clicks.

## Defaults (v0)
- Inertia is opt-in (`OrbitViewportController.inertia.enabled` defaults to `false`).
- Gesture thresholds/speeds defaults live in `docs/monorepo/design-specs/gesture-core.md`.
- Controller speeds/friction defaults live in `docs/monorepo/design-specs/control-core.md`.

If a package needs to diverge from these contracts, call it out in the design spec and update this page in the same change.
