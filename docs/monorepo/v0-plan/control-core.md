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
- Implement OrbitViewportController
  - Define OrbitViewportConfig (radius, min/max, speeds)
  - Store internal state: radius, theta, phi, panX, panY
  - handle(cmd: ViewportCommand)
    - Apply rotation with clamped phi
    - Apply pan offsets
    - Apply zoom with clamped radius
    - Ignore POINTER_CLICK
  - applyToCamera(camera)
    - Convert spherical coords + pan to Cartesian
    - Set camera position & lookAt
  - getState()
- Add basic tests
  - ROTATE updates theta/phi
  - PAN updates panX/panY
  - ZOOM obeys min/max radius
- Export from index.ts
