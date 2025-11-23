# Start-to-MVP Implementation Plan

Central build plan that stitches the per-package v0 plans together. Detailed tasks for each package live in `docs/monorepo/v0-plan/*.md`; this doc defines ordering, milestone goals, and acceptance criteria for v0/MVP.

## MVP definition

- Functional: `@spatial-ui-kit/control-core`, `graph-core`, `graph-three`, `gesture-core`, `handtracking-tfjs`, and `gesture-react` implemented and usable together; `apps/graph-sandbox` runs end-to-end with webcam gestures (rotate/pan/zoom/click) and node selection.
- Non-functional: desktop Chrome/Edge with webcam supported; gesture stack runs at ≳15fps on a modern laptop; camera/model init errors surface via `console.error` and gestures can be disabled gracefully.
- Post-MVP: `apps/soundcloud-graph` (keep its plan in `docs/monorepo/v0-plan/soundcloud-graph.md`).

## Milestones & order

### Milestone 0 – Repo & tooling (DONE)

- Goal: workspace + scripts in place so packages/apps can build.
- Tasks: workspace package manager config; root TS config; builder/test runner choice; optional lint/format; baseline scripts.
- Acceptance: `pnpm install` (or chosen PM) works; `pnpm build` runs across packages/apps even if outputs are stubbed (`docs/monorepo/v0-plan/repo.md`).

### Milestone 1 – Core types & camera control (DONE)

- Packages: `@spatial-ui-kit/control-core` (`docs/monorepo/v0-plan/control-core.md`), `@spatial-ui-kit/graph-core` (`docs/monorepo/v0-plan/graph-core.md`).
- Tasks: implement `ViewportCommand`, `OrbitViewportController`; graph types/helpers + simple layout if needed.
- Acceptance: builds + unit tests; script can apply a rotate command and log camera state.

### Milestone 2 – 3D graph renderer (DONE)

- Package: `@spatial-ui-kit/graph-three` (`docs/monorepo/v0-plan/graph-three.md`).
- Tasks: React/R3F setup; `GraphCanvas` with `graph: Graph<N,E>` prop; camera application; node/edge rendering; mouse + gesture click raycasting.
- Acceptance: story/dev demo renders static graph, responds to mouse, and correctly raycasts when `gestureClick` is set manually.

### Milestone 3 – Gesture engine & hand tracking (DONE)

- Packages: `@spatial-ui-kit/gesture-core` (`docs/monorepo/v0-plan/gesture-core.md`), `@spatial-ui-kit/handtracking-tfjs` (`docs/monorepo/v0-plan/handtracking-tfjs.md`).
- Tasks: implement gesture state machine + helpers; logic tests for rotate/pan/zoom/click; TFJS/MediaPipe wrapper normalizing landmarks; simple mapping test/dev script.
- Acceptance: unit/logic tests pass; dev script logs normalized landmarks from webcam; gesture engine emits expected commands for synthetic frames.

### Milestone 4 – React glue (DONE)

- Package: `@spatial-ui-kit/gesture-react` (`docs/monorepo/v0-plan/gesture-react.md`).
- Tasks: `useGestureControl` hook per design spec (webcam lifecycle, fps limiting, cursor mapping, overlay, `POINTER_CLICK` remap); cleanup on unmount.
- Acceptance: minimal React app logs commands as gestures change and cleans up webcam without crashes.

### Milestone 5 – End-to-end sandbox

- App: `apps/graph-sandbox` (`docs/monorepo/v0-plan/graph-sandbox.md`).
- Tasks: Vite (or similar) scaffold; build dummy graph via `graph-core`; wire `GraphCanvas`, controller, `useGestureControl`, `createTFJSHandModel`; gesture-based node selection HUD/logging.
- Acceptance: on a webcam-equipped laptop you can rotate/pan/zoom and pinch-tap-select nodes; camera denial errors are logged gracefully.

### Milestone 6 – Post-MVP example

- App: `apps/soundcloud-graph` (`docs/monorepo/v0-plan/soundcloud-graph.md`).
- Tasks: OAuth + data fetch; build graph; render with `graph-three`; reuse gesture stack; simple artist detail panel.
- Acceptance: optional stretch; do after MVP is stable.
