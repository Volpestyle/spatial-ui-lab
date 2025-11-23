# @spatial-ui-kit/control-core – viewport commands + orbit controller

Goal v0: Working `ViewportCommand` type and `OrbitViewportController` that can move a Three.js camera.

- Create package skeleton
  - packages/control-core/package.json with name "@spatial-ui-kit/control-core"
  - src/index.ts
  - src/types.ts
  - src/OrbitViewportController.ts
- Define types
  - Implement `ViewportCommand` union in types.ts
    - PAN { dx, dy }
    - ROTATE { dx, dy }
    - ZOOM { delta }
    - POINTER_CLICK { xNorm, yNorm }
  - OrbitViewportConfig: radius, min/max, rotationSpeed, panSpeed, zoomSpeed, inertia config (enabled + friction factors)
- Implement OrbitViewportController
  - Define OrbitViewportConfig (radius, min/max, speeds)
  - Store internal state: radius, theta, phi, panX, panY
  - handle(cmd: ViewportCommand)
    - Apply rotation with clamped phi (direct mode)
    - Apply pan offsets (direct mode)
    - Apply zoom with clamped radius (direct mode)
    - When inertia.enabled, add impulses to velocities instead of directly mutating position
    - Ignore POINTER_CLICK
  - update(dtSeconds): no-op unless inertia.enabled; integrate velocities and apply per-axis friction
  - applyToCamera(camera)
    - Convert spherical coords + pan to Cartesian
    - Set camera position & lookAt
  - getState()
- Add basic tests
  - ROTATE updates theta/phi
  - PAN updates panX/panY
  - ZOOM obeys min/max radius
  - Inertia path: update(dt) decays velocities when enabled (smoke test)
- Export from index.ts
