# Spatial UI Kit Monorepo + Design Specs

Combined overview of the monorepo layout, architectural layers, and links to the detailed package design docs. Code snippets were removed to keep this as a high-level guide.

---

## Core Assumptions

- Monorepo: `spatial-ui-kit`
- Packages: control-core, graph-core, graph-three, gesture-core, handtracking-tfjs, gesture-react
- Stack: TypeScript, ESM + CJS builds, React 18+, Three.js, react-three-fiber

---

## Conceptual Layers

- **Data / Domain**: Defines nodes/edges and how to fetch neighbors.
- **Graph Engine / View**: Renders and interacts with a 3D graph.
- **Input / Control**: Converts user actions into pan/zoom/rotate/click commands.
- **Vision / ML**: Converts webcam pixels into hand landmarks.

Each layer depends downward but is unaware of the specifics above it.

---

## Monorepo Shape

- `apps/`: Domain-specific apps (e.g., SoundCloud graph) and playgrounds.
- `packages/graph-core`: Data model, layout helpers, selection logic.
- `packages/graph-three`: React/Three.js graph renderer that consumes a controller and emits node events.
- `packages/control-core`: Viewport command vocabulary plus orbit-style controller.
- `packages/gesture-core`: Gesture interpreter that emits viewport commands from hand landmark input.
- `packages/handtracking-tfjs`: TF.js/MediaPipe wrapper that produces `TrackedHand[]`.
- `packages/gesture-react`: React hook that owns video/overlay elements, runs the handloop, and passes commands upward.

---

## Package Intent (Quick Read)

- **control-core**: Reusable camera/viewport control that accepts `ViewportCommand`s from any input system.
- **graph-core**: Framework-neutral graph model with optional helpers; no rendering or device knowledge.
- **graph-three**: R3F component that renders graphs, applies a controller to the camera, and supports NDC-based node picking.
- **gesture-core**: Hand landmarks in → `ViewportCommand`s out (rotate, pan, zoom, pointer click).
- **handtracking-tfjs**: Swappable hand-tracking implementation; no opinions about gestures or rendering.
- **gesture-react**: React-friendly wrapper that hosts `<video>` and overlay, runs the hand loop, and forwards commands.

---

## Design Docs Index

- [@spatial-ui-kit/control-core](design-specs/control-core.md)
- [@spatial-ui-kit/graph-core](design-specs/graph-core.md)
- [@spatial-ui-kit/graph-three](design-specs/graph-three.md)
- [@spatial-ui-kit/gesture-core](design-specs/gesture-core.md)
- [@spatial-ui-kit/handtracking-tfjs](design-specs/handtracking-tfjs.md)
- [@spatial-ui-kit/gesture-react](design-specs/gesture-react.md)

Each linked doc covers purpose, public API, internal structure, interactions, and extensibility notes.

---

## How Everything Fits (Data Flow)

- **App layer**: Build a graph, create a controller, initialize a hand model, wire `useGestureControl({ model, onCommand })`, and feed clicks/commands into `GraphCanvas`.
- **Gesture side**: Webcam → video → `HandModel.estimateHands()` → `TrackedHand[]` → `GestureEngine.update()` → `ViewportCommand[]` → controller handles PAN/ROTATE/ZOOM; pointer clicks are stored for the viewer to consume.
- **Rendering side**: Graph + controller → `<GraphCanvas>` → controller applies to camera each frame → nodes/edges rendered → raycast on pointer click (from gestures or mouse) → `onNodeClick`.

---

## Boundaries TL;DR

- **graph-core**: Generic nodes/edges, layout, selection; no React/Three/webcam.
- **control-core**: `ViewportCommand`s + camera controller; no React/gestures.
- **gesture-core**: Hand landmarks to viewport commands; no TF.js or rendering.
- **handtracking-tfjs**: Model + webcam plumbing only; no gesture semantics.
- **graph-three**: R3F graph renderer that consumes a controller and optional gesture click NDC.
- **gesture-react**: React hook that ties DOM elements to gesture-core and handtracking-*.

With this split you can swap models (e.g., Leap Motion), reuse gestures in other 3D apps, or run the graph viewer with mouse/touch-only input.
