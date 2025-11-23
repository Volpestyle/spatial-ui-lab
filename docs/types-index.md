# Canonical Type Index

Where to find the source of truth for shared types. Snippets elsewhere in the docs are illustrative mirrors; update the packages below first and import from them in real code.

- `ViewportCommand`, `OrbitViewportController` → `packages/control-core/src/types.ts` (+ controller in `src/OrbitViewportController.ts`)
- `GraphNode`, `GraphEdge`, `Graph` → `packages/graph-core/src/types.ts`
- `Landmark`, `TrackedHand`, `HandFrame`, `GestureEngineOptions` → `packages/gesture-core/src/types.ts`
- `HandModel`, `createTFJSHandModel` → `packages/handtracking-tfjs/src/index.ts` (see design spec for details)

Cross-package invariants: `docs/contracts.md`. Wiring walkthrough: `docs/monorepo/integration-cookbook.md`.

Design specs for each package live in `docs/monorepo/design-specs/`; treat those and the package source as canonical when updating examples or scaffolds.
