# @spatial-ui-kit/control-core

## Purpose

Define a shared control vocabulary for any 3D viewport and provide a default Orbit-style camera controller. This is the core “input → camera” layer that everything plugs into.

## Public API (v1)

```ts
// types.ts
export type ViewportCommand =
  | { type: "PAN"; dx: number; dy: number } // screen-space “drag”
  | { type: "ROTATE"; dx: number; dy: number } // orbit around target
  | { type: "ZOOM"; delta: number } // zoom in/out
  | { type: "POINTER_CLICK"; xNorm: number; yNorm: number }; // normalized [0,1], (0,0) top-left

export interface OrbitViewportInertiaConfig {
  /**
   * Enable inertial motion. When true, PAN / ROTATE / ZOOM contribute to velocities
   * and motion continues briefly after input stops.
   *
   * Default: false (direct 1:1 control).
   */
  enabled?: boolean;

  /**
   * Fraction of rotation velocity kept per second. 0 = hard stop, 1 = no friction.
   * Default: 0.85
   */
  rotationFriction?: number;

  /**
   * Fraction of pan velocity kept per second. Default: 0.8
   */
  panFriction?: number;

  /**
   * Fraction of zoom velocity kept per second. Default: 0.75
   */
  zoomFriction?: number;
}

// OrbitViewportController.ts
export interface OrbitViewportConfig {
  radius?: number;
  minRadius?: number;
  maxRadius?: number;
  rotationSpeed?: number; // multiplier for ROTATE dx/dy → velocity or angle
  panSpeed?: number; // multiplier for PAN dx/dy
  zoomSpeed?: number; // multiplier for ZOOM delta
  inertia?: OrbitViewportInertiaConfig;
}

export class OrbitViewportController {
  constructor(config?: OrbitViewportConfig);

  // Apply a single command to internal state
  handle(command: ViewportCommand): void;

  // Advance internal state by dtSeconds (no-op when inertia is disabled)
  update(dtSeconds: number): void;

  // Update a Three.js camera
  applyToCamera(camera: THREE.PerspectiveCamera): void;

  // Read-only access or debugging
  getState(): {
    radius: number;
    theta: number;
    phi: number;
    panX: number;
    panY: number;
  };
}
```

Notes
- POINTER_CLICK is included in the command set, but OrbitViewportController ignores it (no camera change). Apps can listen for these commands alongside camera updates.
- xNorm, yNorm are normalized viewport coordinates so we don’t need pixel sizes in the command bus. graph-three converts them to NDC for raycasting.
- Command conventions:
  - dx, dy are unitless deltas (pixels or normalized hand space); treat them as “small numbers where 1.0 is large”.
  - ROTATE: +dx rotates view to the right; +dy rotates up.
  - PAN: +dx pans the target right; +dy pans up.
  - ZOOM: +delta zooms in (decreases radius).

### Default values (v0)
- `radius`: 40
- `minRadius` / `maxRadius`: 5 / 200
- `rotationSpeed`: 0.01
- `panSpeed`: 0.01
- `zoomSpeed`: 0.1
- `inertia.enabled`: false
- `inertia.rotationFriction` / `panFriction` / `zoomFriction`: 0.85 / 0.8 / 0.75

## Internal Structure

```
packages/control-core/src/
  index.ts             # re-exports
  types.ts             # ViewportCommand, etc.
  OrbitViewportController.ts
  mathUtils.ts         # (optional) helpers for angle wrapping, clamping etc.
```

OrbitViewportController behavior:
- Direct (default, inertia.disabled): handle() immediately applies deltas:
  - ROTATE: theta -= dx * rotationSpeed; phi -= dy * rotationSpeed; clamp phi to avoid flipping over poles.
  - PAN: panX += dx * panSpeed; panY += dy * panSpeed.
  - ZOOM: radius *= (1 - delta * zoomSpeed); clamp between minRadius / maxRadius.
  - update(dt) is a no-op.
- Inertial (inertia.enabled):
  - handle() adds to velocities (rotation, pan, zoom) instead of directly mutating position.
  - update(dtSeconds) integrates velocities into position (zoom integrates in log-radius space to keep zoom feel consistent with the multiplicative direct mode), applies friction per axis, and clamps phi/radius.
  - Small velocities can be snapped to zero to avoid endless drift.

## Interactions

- Inputs (mouse, touch, gestures, VR controllers…) emit ViewportCommands.
- graph-three (or any renderer) calls controller.update(dtSeconds) once per frame (no-op in direct mode), then applyToCamera() to sync the Three.js camera.

## Extensibility

- Later add alternative controllers: FpsViewportController, TrackballViewportController.
- Keep ViewportCommand stable; controllers can ignore commands they don’t care about.
