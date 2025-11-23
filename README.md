# spatial-ui-kit

> A modular toolkit for building gesture-driven 3D graph interfaces on the web.

Think Tony Stark-style interaction for anything you can model as a graph: SoundCloud artists, org charts, codebases, knowledge graphs, and more.

## Table of contents

- [What is this?](#what-is-this)
- [Monorepo layout](#monorepo-layout)
- [Docs & specs](#docs--specs)
- [Packages](#packages)
  - [Canonical types](#canonical-types)
  - [@spatial-ui-kit/control-core](#spatial-ui-kitcontrol-core)
  - [@spatial-ui-kit/graph-core](#spatial-ui-kitgraph-core)
  - [@spatial-ui-kit/graph-three](#spatial-ui-kitgraph-three)
  - [@spatial-ui-kit/gesture-core](#spatial-ui-kitgesture-core)
  - [@spatial-ui-kit/handtracking-tfjs](#spatial-ui-kithandtracking-tfjs)
  - [@spatial-ui-kit/gesture-react](#spatial-ui-kitgesture-react)
- [Targets & expectations](#targets--expectations)
- [Quick start (dev)](#quick-start-dev)
- [Minimal usage example](#minimal-usage-example)
- [Architecture](#architecture)
- [Roadmap / ideas](#roadmap--ideas)
- [Acknowledgements](#acknowledgements)

## What is this?

`spatial-ui-kit` is a **monorepo** of small, focused packages that together provide:

- A standard way to control a 3D viewport (pan / zoom / rotate / click).
- A 3D graph renderer built on Three.js + react-three-fiber.
- A gesture engine that turns hand poses into viewport commands.
- A hand tracking wrapper (TensorFlow.js + MediaPipe Hands).
- React hooks to wire all of the above with only a webcam.

Mix and match:

- Use only the graph renderer (mouse/touch).
- Use only the gesture stack in your own 3D app.
- Or run the full pipeline: webcam -> hand landmarks -> gestures -> 3D graph.

## Monorepo layout

```text
spatial-ui-kit/
  package.json
  pnpm-workspace.yaml   # or yarn / nx / turbo config

  packages/
    control-core/       # ViewportCommand + OrbitViewportController
    graph-core/         # Graph data types & helpers
    graph-three/        # Three.js / R3F graph renderer
    gesture-core/       # Hand -> ViewportCommand gesture engine
    handtracking-tfjs/  # TF.js / MediaPipe Hands -> TrackedHand[]
    gesture-react/      # React hook to wire video + model + gestures

  apps/
    soundcloud-graph/   # Example: SoundCloud artist universe
    graph-sandbox/      # Generic playground for graphs + gestures
```

Each `packages/*` directory is a publishable npm package (for example, `@spatial-ui-kit/graph-three`).

## Docs & specs

If you’re implementing or integrating the kit, these are the canonical docs:

- [Monorepo overview](docs/monorepo/monorepo.md)
- [Cross-package contracts](docs/contracts.md)
- [Canonical type index](docs/types-index.md)

Core workflow docs:

- [MVP / start-to-finish plan](docs/monorepo/mvp-plan.md)
- [Integration cookbook](docs/monorepo/integration-cookbook.md)

Per-package design specs:

- [@spatial-ui-kit/control-core](docs/monorepo/design-specs/control-core.md)
- [@spatial-ui-kit/graph-core](docs/monorepo/design-specs/graph-core.md)
- [@spatial-ui-kit/graph-three](docs/monorepo/design-specs/graph-three.md)
- [@spatial-ui-kit/gesture-core](docs/monorepo/design-specs/gesture-core.md)
- [@spatial-ui-kit/handtracking-tfjs](docs/monorepo/design-specs/handtracking-tfjs.md)
- [@spatial-ui-kit/gesture-react](docs/monorepo/design-specs/gesture-react.md)

## Packages

### Canonical types

The canonical definitions for shared types live with their packages; see `docs/types-index.md` for direct links. Snippets elsewhere are illustrative mirrors.
Cross-package invariants: `docs/contracts.md`. Wiring checklist: `docs/monorepo/integration-cookbook.md`.

### @spatial-ui-kit/control-core

- Defines the canonical viewport command model.
- Commands: `PAN { dx, dy }`, `ROTATE { dx, dy }`, `ZOOM { delta }`, `POINTER_CLICK { xNorm, yNorm }` (normalized `[0,1]`).
- Conventions: +dx rotates/pans right, +dy rotates/pans up, +delta zooms in (smaller radius).
- `OrbitViewportController` applies commands and syncs to a `THREE.PerspectiveCamera`; inertia is opt-in via `config.inertia` and `controller.update(dt)` (default is direct, no momentum).

### @spatial-ui-kit/graph-core

- Graph data model without rendering concerns.
- Types: `GraphNode`, `GraphEdge`, `Graph`.
- Future: layouts, neighbor queries, clustering, and more.

### @spatial-ui-kit/graph-three

- Renders a `Graph` in 3D with Three.js / react-three-fiber via `<GraphCanvas />`.
- Handles camera updates (calls `controller.update(dt)` + `applyToCamera` each frame), node/edge rendering (customizable), and raycasting for mouse and gesture-driven clicks (it converts `{ xNorm, yNorm }` to NDC internally).
- v0 is tuned for small–medium graphs (up to a few thousand nodes/edges); larger scenes will need LOD/clustering later.

```ts
type GraphCanvasProps<N = unknown, E = unknown> = {
  graph: Graph<N, E>;
  controller: OrbitViewportController;
  onNodeClick?: (node: GraphNode<N>) => void;
  onNodeHover?: (node: GraphNode<N> | null) => void;
  gestureClick?: { xNorm: number; yNorm: number; token: number };
  renderNode?: (node: GraphNode<N>) => React.ReactNode;
  renderEdge?: (edge: GraphEdge<E>) => React.ReactNode;
  nodeRadius?: number;
  showEdges?: boolean;
};
```

`xNorm`/`yNorm` are normalized viewport coordinates `[0,1]` with a top-left origin; `graph-three` converts them to WebGL NDC (`[-1,1]`) internally before raycasting.

### @spatial-ui-kit/gesture-core

- Turns hand skeletons into viewport commands.
- Types: `Landmark`, `TrackedHand`, `HandFrame`.
- `GestureEngine.update(frame: HandFrame): ViewportCommand[]`.
- `GestureEngine.getCursor(): { x: number; y: number }` returns a normalized cursor position.
- Default gesture mappings:
  - Single-hand thumb + index pinch drag -> `ROTATE`.
  - Single-hand thumb + index + middle double pinch drag -> `PAN`.
  - Two-hand pinch in/out -> `ZOOM`.
  - Open point (index extended) + quick pinch tap -> `POINTER_CLICK` at cursor.

### @spatial-ui-kit/handtracking-tfjs

- Wraps TF.js + MediaPipe Hands to produce `TrackedHand[]` from a video element.
- `HandModel.estimateHands(video: HTMLVideoElement): Promise<TrackedHand[]>`.
- `createTFJSHandModel()` initializes `@tensorflow-models/hand-pose-detection` and normalizes keypoints to `[0,1]`.

### @spatial-ui-kit/gesture-react

- React wiring for gestures (webcam + overlay + gesture engine).

```ts
type UseGestureControlOptions = {
  model: HandModel | null;
  onCommand: (cmd: ViewportCommand) => void;
  mapCursorToViewport?: (cursor: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  fps?: number;
  debug?: boolean;
};

function useGestureControl(options: UseGestureControlOptions): {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
};
```

Internally this hook:

- Starts the webcam via `getUserMedia`.
- Runs `model.estimateHands(video)` each frame and feeds results to `GestureEngine.update`.
- Calls `onCommand` with viewport commands.
- Applies `mapCursorToViewport` (identity by default) before emitting cursor data or POINTER_CLICK so you can remap hand coordinates into a sub-viewport.
- Always rewrites `POINTER_CLICK.xNorm/yNorm` using the mapped cursor so downstream consumers can assume clicks are already viewport-normalized (don’t remap twice).
- Draws a 2D cursor/debug overlay on the canvas.

## Targets & expectations

- Platform: desktop Chrome/Edge on a modern laptop GPU.
- Performance: gesture stack can run at ~15–30fps while the scene renders at full frame rate; smoothing/deadzones in gesture-core + control-core hide lower input update rates.
- Graph scale (v0): small–medium graphs (a few thousand nodes/edges).

## Quick start (dev)

Example using pnpm; yarn/npm workspaces are similar.

1. Clone and install

```bash
git clone https://github.com/yourname/spatial-ui-kit.git
cd spatial-ui-kit
pnpm install
```

2. Run the graph sandbox app

```bash
pnpm dev --filter graph-sandbox
```

Open the printed URL in your browser. You should see a simple 3D graph you can rotate/zoom with the mouse.

3. Enable gesture control (sandbox)

In the sandbox app, toggle "Enable gestures" (if there is a UI) or ensure the sandbox imports the gesture hook:

```ts
const controller = useRef(new OrbitViewportController());
const [handModel, setHandModel] = useState<HandModel | null>(null);

useEffect(() => {
  createTFJSHandModel().then(setHandModel).catch(console.error);
}, []);

const { videoRef, overlayRef } = useGestureControl({
  model: handModel,
  onCommand: (cmd) => controller.current.handle(cmd),
  mapCursorToViewport: (cursor) => cursor,
});
```

Webcam gestures in the sandbox UI:

- One-hand pinch drag → rotate.
- Two-hand pinch → zoom.
- One-hand double pinch drag → pan.
- Open point + pinch tap → click on nodes.

Sandbox tips:

- To run dev: `pnpm dev --filter graph-sandbox` (Vite dev server on port 5173 by default).
- To build/preview: `pnpm build --filter graph-sandbox` then `pnpm --filter graph-sandbox preview`.
- In the UI, click “Enable gestures” to load the hand model; allow webcam permission. Last clicked node and model status show in the HUD. The video thumb is dimmed in the corner; overlay draws the cursor/debug marker.

## Minimal usage example

This snippet mirrors the package APIs; keep it in sync when public signatures change.

Stripped-down usage in a custom React app:

```tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Graph, GraphNode, GraphEdge } from "@spatial-ui-kit/graph-core";
import { GraphCanvas } from "@spatial-ui-kit/graph-three";
import {
  OrbitViewportController,
  ViewportCommand,
} from "@spatial-ui-kit/control-core";
import { useGestureControl } from "@spatial-ui-kit/gesture-react";
import {
  HandModel,
  createTFJSHandModel,
} from "@spatial-ui-kit/handtracking-tfjs";

type NodeData = { label?: string };
type EdgeData = Record<string, never>;

const graph: Graph<NodeData, EdgeData> = {
  nodes: [
    { id: "a", position: [-5, 0, 0], data: {} },
    { id: "b", position: [5, 0, 0], data: {} },
    { id: "c", position: [0, 5, 0], data: {} },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", data: {} },
    { id: "ac", source: "a", target: "c", data: {} },
    { id: "bc", source: "b", target: "c", data: {} },
  ],
};

export function App() {
  const controllerRef = useRef(new OrbitViewportController());
  const [handModel, setHandModel] = useState<HandModel | null>(null);
  const [gestureClick, setGestureClick] = useState<{
    xNorm: number;
    yNorm: number;
    token: number;
  } | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    createTFJSHandModel()
      .then((model) => !cancelled && setHandModel(model))
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCommand = useCallback((cmd: ViewportCommand) => {
    if (cmd.type === "POINTER_CLICK") {
      const token = ++tokenRef.current;
      setGestureClick({ xNorm: cmd.xNorm, yNorm: cmd.yNorm, token });
      return;
    }
    controllerRef.current.handle(cmd);
  }, []);

  const { videoRef, overlayRef } = useGestureControl({
    model: handModel,
    onCommand: handleCommand,
    mapCursorToViewport: React.useCallback((cursor) => cursor, []), // optional: remap to a sub-viewport
  });

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <GraphCanvas
        graph={graph}
        controller={controllerRef.current}
        onNodeClick={(node: GraphNode<NodeData>) =>
          console.log("Clicked node", node.id)
        }
        gestureClick={gestureClick ?? undefined}
      />

      <canvas
        ref={overlayRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      <video
        ref={videoRef}
        style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          width: 160,
          opacity: 0.2,
        }}
        muted
        playsInline
      />
    </div>
  );
}
```

## Architecture

- Data / domain: your app builds a `Graph<NodeData, EdgeData>` from any source.
- Graph + control: `@spatial-ui-kit/graph-core`, `@spatial-ui-kit/control-core`, `@spatial-ui-kit/graph-three`.
- Gestures (optional): `@spatial-ui-kit/handtracking-tfjs`, `@spatial-ui-kit/gesture-core`, `@spatial-ui-kit/gesture-react`.

Everything speaks `ViewportCommand`, so you can plug in mouse/touch listeners, gamepads/VR controllers, or alternate gesture engines.

## Roadmap / ideas

- More camera controllers (FPS, trackball).
- Additional gesture presets (two-hand rotate, mode switches, etc.).
- Built-in graph layouts and clustering utilities.
- VR / WebXR bindings.
- Additional example integrations (Git graph, API explorer, etc.).

## Acknowledgements

- Three.js
- react-three-fiber
- TensorFlow.js
- MediaPipe Hands

---

You can trim or expand sections as more pieces ship, but this should serve as a solid home page for the repo.
