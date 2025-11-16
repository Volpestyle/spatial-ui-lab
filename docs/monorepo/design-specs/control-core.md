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

// OrbitViewportController.ts
export interface OrbitViewportConfig {
  radius?: number;
  minRadius?: number;
  maxRadius?: number;
  rotationSpeed?: number; // multiplier for ROTATE dx/dy
  panSpeed?: number;
}

export class OrbitViewportController {
  constructor(config?: OrbitViewportConfig);

  // Apply a single command to internal state
  handle(command: ViewportCommand): void;

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

## Internal Structure

```
packages/control-core/src/
  index.ts             # re-exports
  types.ts             # ViewportCommand, etc.
  OrbitViewportController.ts
  mathUtils.ts         # (optional) helpers for angle wrapping, clamping etc.
```

OrbitViewportController.handle() behavior:
- ROTATE: theta -= dx * rotationSpeed; phi -= dy * rotationSpeed; clamp phi to avoid flipping over poles.
- PAN: panX += dx * panSpeed; panY += dy * panSpeed.
- ZOOM: radius *= (1 - delta * zoomSpeed); clamp between minRadius / maxRadius.

## Interactions

- Inputs (mouse, touch, gestures, VR controllers…) emit ViewportCommands.
- graph-three (or any renderer) uses OrbitViewportController.applyToCamera() inside its render loop.

## Extensibility

- Later add alternative controllers: FpsViewportController, TrackballViewportController.
- Keep ViewportCommand stable; controllers can ignore commands they don’t care about.
