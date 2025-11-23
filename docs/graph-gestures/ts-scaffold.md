# TypeScript Scaffold

A gesture-driven 3D node graph scaffold you can adapt to any data source. Includes project structure, core types, hand tracking, gesture engine, controller/scene, and React wiring.

> This is an illustrative scaffold; the canonical APIs live in the monorepo design specs and package types (see `docs/types-index.md`). Swap the local mirrors for imports from `@spatial-ui-kit/*` when you implement the real packages.
> Treat this as the single “demo app” scaffold referenced by the v0 plan; prefer linking back here (or to the design specs) instead of copying the code into other docs.

---

## 1. Project Structure

> For production, track consecutive pinched/not-pinched frames in `HandState` (or store the last N samples) so single/double pinch modes have hysteresis, and expose a `getDebugState()` helper for HUD overlays.

```
src/
  main.tsx            # React entrypoint
  App.tsx             # Root app
  graph/
    graphTypes.ts
    OrbitViewportController.ts
    GraphScene.tsx
  gestures/
    gestureTypes.ts
    HandTracker.ts
    GestureEngine.ts
    useGestureControl.ts
    createTFJSHandModel.ts # stub; swap for @spatial-ui-kit/handtracking-tfjs
```

---

## 2. Core Types

This scaffold wraps the monorepo `@spatial-ui-kit/graph-core` types so the API lines up with the real packages; swap in the core imports directly when you wire against the published modules. The canonical definitions live with the packages themselves (see `docs/types-index.md`).

```ts
// src/graph/graphTypes.ts
import type {
  GraphNode as CoreGraphNode,
  GraphEdge as CoreGraphEdge,
} from "@spatial-ui-kit/graph-core";
import type { ViewportCommand } from "@spatial-ui-kit/control-core";

// Wrap graph-core types so the scaffold mirrors the monorepo API.
export type GraphNode = CoreGraphNode<{ label?: string }>;
export type GraphEdge = CoreGraphEdge<{}>;

export type GraphMode = "normal" | "hotness" | "cluster";

// Optionally extend commands at the graph layer.
export type GraphCommand =
  | ViewportCommand
  | { type: "SET_MODE"; mode: GraphMode };

export type GestureClickNormalized = {
  xNorm: number;
  yNorm: number;
  token: number;
};
```

```ts
// src/gestures/gestureTypes.ts
export type Handedness = "Left" | "Right";

export type Landmark = {
  x: number; // normalized [0,1] in video space
  y: number; // normalized [0,1]
  z?: number;
};

export type TrackedHand = {
  handedness: Handedness;
  landmarks: Landmark[]; // 21 landmarks
};

export type HandFrame = {
  hands: TrackedHand[];
  timestamp: number;
};
```

---

## 3. Hand Tracking Wrapper (webcam + model)

This module owns the webcam stream and calls a hand model. It emits `HandFrame` objects and stays unaware of gestures.

```ts
// src/gestures/HandTracker.ts
import { HandFrame, TrackedHand } from "./gestureTypes";

export type HandModel = {
  estimateHands(video: HTMLVideoElement): Promise<TrackedHand[]>;
};

type HandTrackerOptions = {
  videoElement: HTMLVideoElement;
  model: HandModel;
  onFrame: (frame: HandFrame) => void;
};

export class HandTracker {
  private video: HTMLVideoElement;
  private model: HandModel;
  private onFrame: (frame: HandFrame) => void;
  private stream: MediaStream | null = null;
  private running = false;

  constructor(options: HandTrackerOptions) {
    this.video = options.videoElement;
    this.model = options.model;
    this.onFrame = options.onFrame;
  }

  async start() {
    if (this.running) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  private async loop() {
    if (!this.running) return;
    try {
      const hands = await this.model.estimateHands(this.video);
      const frame: HandFrame = { hands, timestamp: performance.now() };
      this.onFrame(frame);
    } catch (err) {
      console.error("HandTracker error", err);
    }
    requestAnimationFrame(() => this.loop());
  }
}
```

---

## 4. Gesture Engine (your gestures)

Implements single pinch → rotate, double pinch → pan, two-hand pinch → zoom, open-point + tap → click.

```ts
// src/gestures/GestureEngine.ts
import { HandFrame, TrackedHand, Landmark, Handedness } from "./gestureTypes";
import { ViewportCommand } from "../graph/graphTypes";

type EngineMode = "IDLE" | "ROTATE" | "PAN" | "ZOOM" | "CURSOR";

type HandState = {
  lastCenter?: { x: number; y: number };
  isSinglePinch: boolean;
  isDoublePinch: boolean;
  pinchActive: boolean;
  pinchStartTime: number | null;
  pinchJustReleasedAt: number | null;
};

type GestureEngineOptions = {
  tapMaxDurationMs?: number;
  pinchIndexThreshold?: number;
  pinchMiddleThreshold?: number;
  rotationSensitivity?: number;
  panSensitivity?: number;
  zoomSensitivity?: number;
  // Deadzones are scaffold-only smoothing knobs; keep them internal if the public API stays minimal.
  moveDeadzone?: number;
  zoomDeadzone?: number;
};

export class GestureEngine {
  private mode: EngineMode = "IDLE";
  private handStates: Record<"Left" | "Right", HandState> = {
    Left: {
      isSinglePinch: false,
      isDoublePinch: false,
      pinchActive: false,
      pinchStartTime: null,
      pinchJustReleasedAt: null,
    },
    Right: {
      isSinglePinch: false,
      isDoublePinch: false,
      pinchActive: false,
      pinchStartTime: null,
      pinchJustReleasedAt: null,
    },
  };

  private zoomBaseDistance: number | null = null;
  private cursor = { x: 0.5, y: 0.5 };

  private readonly tapMaxDurationMs: number;
  private readonly pinchIndexThreshold: number;
  private readonly pinchMiddleThreshold: number;
  private readonly rotationSensitivity: number;
  private readonly panSensitivity: number;
  private readonly zoomSensitivity: number;
  private readonly moveDeadzone: number;
  private readonly zoomDeadzone: number;

  constructor(opts: GestureEngineOptions = {}) {
    this.tapMaxDurationMs = opts.tapMaxDurationMs ?? 220;
    this.pinchIndexThreshold = opts.pinchIndexThreshold ?? 0.06;
    this.pinchMiddleThreshold = opts.pinchMiddleThreshold ?? 0.07;
    this.rotationSensitivity = opts.rotationSensitivity ?? 200;
    this.panSensitivity = opts.panSensitivity ?? 100;
    this.zoomSensitivity = opts.zoomSensitivity ?? 5;
    this.moveDeadzone = opts.moveDeadzone ?? 0.0015;
    this.zoomDeadzone = opts.zoomDeadzone ?? 0.001;
  }

  getCursor() {
    return this.cursor;
  }

  getDebugState(): { mode: EngineMode; primaryHand?: Handedness } {
    const rightActive = this.handStates.Right.lastCenter != null;
    const leftActive = this.handStates.Left.lastCenter != null;
    let primaryHand: Handedness | undefined;
    if (rightActive) primaryHand = "Right";
    else if (leftActive) primaryHand = "Left";
    return { mode: this.mode, primaryHand };
  }

  update(frame: HandFrame): ViewportCommand[] {
    const commands: ViewportCommand[] = [];
    const { hands, timestamp } = frame;

    const left = hands.find((h) => h.handedness === "Left");
    const right = hands.find((h) => h.handedness === "Right");

    if (left) this.updateHandPinches(left, timestamp);
    if (right) this.updateHandPinches(right, timestamp);

    // Two-hand pinch → zoom (incremental deltas)
    if (left && right && this.isPinching(left) && this.isPinching(right)) {
      const dist = this.distanceBetweenHands(left, right);
      if (this.mode !== "ZOOM") {
        this.mode = "ZOOM";
        this.zoomBaseDistance = dist;
      } else if (this.zoomBaseDistance != null) {
        const delta = dist - this.zoomBaseDistance;
        this.zoomBaseDistance = dist;
        const zoomDelta = delta * this.zoomSensitivity;
        if (Math.abs(zoomDelta) > this.zoomDeadzone) {
          commands.push({ type: "ZOOM", delta: zoomDelta });
        }
      }
    } else if (this.mode === "ZOOM") {
      this.mode = "IDLE";
      this.zoomBaseDistance = null;
    }

    // Single-hand gestures when not zooming
    if (this.mode !== "ZOOM") {
      const primary = right ?? left;
      if (primary) {
        const state = this.handStates[primary.handedness];
        const center = this.handCenter(primary);

        if (this.isOpenPoint(primary)) {
          this.mode = "CURSOR";
          const indexTip = primary.landmarks[8];
          this.cursor.x = this.clamp01(indexTip.x);
          this.cursor.y = this.clamp01(indexTip.y);

          const isTap = this.checkPinchTap(primary, state, timestamp);
          if (isTap) {
            commands.push({
              type: "POINTER_CLICK",
              xNorm: this.cursor.x,
              yNorm: this.cursor.y,
            });
          }
          state.lastCenter = undefined;
        } else if (this.mode !== "CURSOR") {
          const lastCenter = state.lastCenter ?? center;
          const dx = center.x - lastCenter.x;
          const dy = center.y - lastCenter.y;
          const moveMag = Math.hypot(dx, dy);

          if (state.isDoublePinch) {
            this.mode = "PAN";
            if (moveMag > this.moveDeadzone) {
              commands.push({
                type: "PAN",
                dx: dx * this.panSensitivity,
                dy: dy * this.panSensitivity,
              });
            }
          } else if (state.isSinglePinch) {
            this.mode = "ROTATE";
            if (moveMag > this.moveDeadzone) {
              commands.push({
                type: "ROTATE",
                dx: dx * this.rotationSensitivity,
                dy: dy * this.rotationSensitivity,
              });
            }
          } else if (this.mode !== "CURSOR") {
            this.mode = "IDLE";
          }

          state.lastCenter = center;
        } else {
          // exited cursor pose; wait a frame before camera commands resume
          this.mode = "IDLE";
        }
      } else {
        this.mode = "IDLE";
      }
    }

    return commands;
  }

  // Helpers
  private updateHandPinches(hand: TrackedHand, timestamp: number) {
    const state = this.handStates[hand.handedness];
    const thumbTip = hand.landmarks[4];
    const indexTip = hand.landmarks[8];
    const middleTip = hand.landmarks[12];

    const dIndex = this.dist2D(thumbTip, indexTip);
    const dMiddle = this.dist2D(thumbTip, middleTip);

    const pinchIndex = dIndex < this.pinchIndexThreshold;
    const pinchMiddle = dMiddle < this.pinchMiddleThreshold;

    state.isDoublePinch = pinchIndex && pinchMiddle;
    state.isSinglePinch = pinchIndex && !pinchMiddle;

    const wasPinching = state.pinchActive;
    if (!wasPinching && pinchIndex) {
      state.pinchActive = true;
      state.pinchStartTime = timestamp;
      state.pinchJustReleasedAt = null;
    } else if (wasPinching && !pinchIndex) {
      state.pinchActive = false;
      state.pinchJustReleasedAt = timestamp;
    } else if (!pinchIndex) {
      state.pinchActive = false;
    }
  }

  private checkPinchTap(
    hand: TrackedHand,
    state: HandState,
    timestamp: number
  ): boolean {
    const thumbTip = hand.landmarks[4];
    const indexTip = hand.landmarks[8];
    const dIndex = this.dist2D(thumbTip, indexTip);
    const pinchIndex = dIndex < this.pinchIndexThreshold;

    if (
      state.pinchJustReleasedAt != null &&
      state.pinchStartTime != null
    ) {
      const duration = state.pinchJustReleasedAt - state.pinchStartTime;
      state.pinchJustReleasedAt = null;
      state.pinchStartTime = null;
      return duration <= this.tapMaxDurationMs;
    }

    if (
      state.pinchActive &&
      state.pinchStartTime != null &&
      timestamp - state.pinchStartTime > this.tapMaxDurationMs
    ) {
      state.pinchActive = false;
      state.pinchStartTime = null;
    }
    return false;
  }

  private isPinching(hand: TrackedHand): boolean {
    const thumbTip = hand.landmarks[4];
    const indexTip = hand.landmarks[8];
    return this.dist2D(thumbTip, indexTip) < this.pinchIndexThreshold;
  }

  private distanceBetweenHands(a: TrackedHand, b: TrackedHand): number {
    const ca = this.handCenter(a);
    const cb = this.handCenter(b);
    return this.dist2D(ca, cb);
  }

  private handCenter(hand: TrackedHand): Landmark {
    const ids = [0, 5, 9, 13, 17];
    let x = 0;
    let y = 0;
    for (const i of ids) {
      x += hand.landmarks[i].x;
      y += hand.landmarks[i].y;
    }
    return { x: x / ids.length, y: y / ids.length } as Landmark;
  }

  private isOpenPoint(hand: TrackedHand): boolean {
    const indexExtended = this.isFingerExtended(hand, 8, 6, 5);
    const middleExtended = this.isFingerExtended(hand, 12, 10, 9);
    const ringExtended = this.isFingerExtended(hand, 16, 14, 13);
    const pinkyExtended = this.isFingerExtended(hand, 20, 18, 17);

    const thumbTip = hand.landmarks[4];
    const indexTip = hand.landmarks[8];
    const pinchIndex =
      this.dist2D(thumbTip, indexTip) < this.pinchIndexThreshold;

    return (
      indexExtended &&
      !middleExtended &&
      !ringExtended &&
      !pinkyExtended &&
      !pinchIndex
    );
  }

  private isFingerExtended(
    hand: TrackedHand,
    tipIndex: number,
    pipIndex: number,
    mcpIndex: number
  ): boolean {
    const tip = hand.landmarks[tipIndex];
    const pip = hand.landmarks[pipIndex];
    const mcp = hand.landmarks[mcpIndex];

    const v1x = tip.x - pip.x;
    const v1y = tip.y - pip.y;
    const v2x = pip.x - mcp.x;
    const v2y = pip.y - mcp.y;

    const dot = v1x * v2x + v1y * v2y;
    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);
    const cosTh = dot / (mag1 * mag2 + 1e-6);

    return cosTh > 0.7; // nearly straight line
  }

  private dist2D(a: Landmark, b: Landmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  private clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
  }
}
```

---

## 5. Graph Controller + 3D Scene

### Camera controller

Supports optional inertia (default off); `update(dt)` is a no-op unless `inertia.enabled === true`. Zoom integrates in log-radius space so inertial zoom feels the same as the multiplicative direct mode.

```ts
// src/graph/OrbitViewportController.ts
import * as THREE from "three";
import { ViewportCommand } from "./graphTypes";

type OrbitViewportInertiaConfig = {
  enabled?: boolean;
  rotationFriction?: number;
  panFriction?: number;
  zoomFriction?: number;
};

type OrbitViewportConfig = {
  radius?: number;
  minRadius?: number;
  maxRadius?: number;
  rotationSpeed?: number;
  panSpeed?: number;
  zoomSpeed?: number;
  inertia?: OrbitViewportInertiaConfig;
};

export class OrbitViewportController {
  private radius: number;
  private logRadius: number;
  private theta = 0;
  private phi = Math.PI / 4;
  private panX = 0;
  private panY = 0;

  private rotVelTheta = 0;
  private rotVelPhi = 0;
  private panVelX = 0;
  private panVelY = 0;
  private zoomVelLog = 0;

  private readonly rotationSpeed: number;
  private readonly panSpeed: number;
  private readonly zoomSpeed: number;
  private readonly minRadius: number;
  private readonly maxRadius: number;
  private readonly minLogRadius: number;
  private readonly maxLogRadius: number;
  private readonly inertia: OrbitViewportInertiaConfig;

  constructor(config: OrbitViewportConfig = {}) {
    this.minRadius = config.minRadius ?? 5;
    this.maxRadius = config.maxRadius ?? 200;
    this.radius = this.clampRadius(config.radius ?? 40);
    this.logRadius = Math.log(this.radius);
    this.minLogRadius = Math.log(this.minRadius);
    this.maxLogRadius = Math.log(this.maxRadius);
    this.rotationSpeed = config.rotationSpeed ?? 0.01;
    this.panSpeed = config.panSpeed ?? 0.01;
    this.zoomSpeed = config.zoomSpeed ?? 0.1;
    this.inertia = config.inertia ?? {};
  }

  handle(cmd: ViewportCommand) {
    const inertiaOn = this.inertia.enabled === true;
    switch (cmd.type) {
      case "ROTATE":
        if (inertiaOn) {
          this.rotVelTheta += -cmd.dx * this.rotationSpeed;
          this.rotVelPhi += -cmd.dy * this.rotationSpeed;
        } else {
          this.theta -= cmd.dx * this.rotationSpeed;
          this.phi = this.clampPhi(this.phi - cmd.dy * this.rotationSpeed);
        }
        break;
      case "PAN":
        if (inertiaOn) {
          this.panVelX += cmd.dx * this.panSpeed;
          this.panVelY += cmd.dy * this.panSpeed;
        } else {
          this.panX += cmd.dx * this.panSpeed;
          this.panY += cmd.dy * this.panSpeed;
        }
        break;
      case "ZOOM":
        if (inertiaOn) {
          this.zoomVelLog += -cmd.delta * this.zoomSpeed;
        } else {
          this.radius = this.clampRadius(
            this.radius * (1 - cmd.delta * this.zoomSpeed)
          );
          this.logRadius = Math.log(this.radius);
        }
        break;
      case "POINTER_CLICK":
        break; // clicks are handled by the viewer (raycast)
    }
  }

  update(dtSeconds: number) {
    if (this.inertia.enabled !== true) return;

    this.theta += this.rotVelTheta * dtSeconds;
    this.phi = this.clampPhi(this.phi + this.rotVelPhi * dtSeconds);
    this.panX += this.panVelX * dtSeconds;
    this.panY += this.panVelY * dtSeconds;
    this.logRadius = this.clampLogRadius(
      this.logRadius + this.zoomVelLog * dtSeconds
    );
    this.radius = Math.exp(this.logRadius);

    const rotFactor = Math.pow(this.inertia.rotationFriction ?? 0.85, dtSeconds);
    const panFactor = Math.pow(this.inertia.panFriction ?? 0.8, dtSeconds);
    const zoomFactor = Math.pow(this.inertia.zoomFriction ?? 0.75, dtSeconds);

    this.rotVelTheta *= rotFactor;
    this.rotVelPhi *= rotFactor;
    this.panVelX *= panFactor;
    this.panVelY *= panFactor;
    this.zoomVelLog *= zoomFactor;

    if (Math.abs(this.rotVelTheta) < 1e-4) this.rotVelTheta = 0;
    if (Math.abs(this.rotVelPhi) < 1e-4) this.rotVelPhi = 0;
    if (Math.abs(this.panVelX) < 1e-4) this.panVelX = 0;
    if (Math.abs(this.panVelY) < 1e-4) this.panVelY = 0;
    if (Math.abs(this.zoomVelLog) < 1e-4) this.zoomVelLog = 0;
  }

  applyToCamera(camera: THREE.PerspectiveCamera) {
    const x =
      this.radius * Math.sin(this.phi) * Math.cos(this.theta) + this.panX;
    const y = this.radius * Math.cos(this.phi) + this.panY;
    const z = this.radius * Math.sin(this.phi) * Math.sin(this.theta);

    camera.position.set(x, y, z);
    camera.lookAt(this.panX, this.panY, 0);
    camera.updateProjectionMatrix();
  }

  private clampPhi(value: number) {
    return Math.max(0.1, Math.min(Math.PI - 0.1, value));
  }

  private clampRadius(value: number) {
    return Math.max(this.minRadius, Math.min(this.maxRadius, value));
  }

  private clampLogRadius(value: number) {
    return Math.max(this.minLogRadius, Math.min(this.maxLogRadius, value));
  }
}
```

### Three.js scene (react-three-fiber)

Prefer `GraphCanvas` from `@spatial-ui-kit/graph-three` for the real app. If you keep a local stub for the scaffold, call it `GraphScene` and only implement the minimal raycast hook; keep the canonical implementation in one place.

```tsx
// src/graph/GraphScene.tsx (illustrative stub)
const raycaster = useMemo(() => new THREE.Raycaster(), []);
useFrame((state) => {
  controller.update(state.clock.getDelta());
  controller.applyToCamera(camera as THREE.PerspectiveCamera);
});

useEffect(() => {
  if (!gestureClick || !onClickNode) return;
  const ndcX = gestureClick.xNorm * 2 - 1;
  const ndcY = -(gestureClick.yNorm * 2 - 1);
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
  const hit = raycaster.intersectObjects(nodeMeshes, false)[0];
  if (hit) onClickNode(meshIdLookup.get(hit.object));
}, [gestureClick, camera, onClickNode, nodeMeshes, meshIdLookup, raycaster]);
```

> For the full implementation, see `docs/monorepo/design-specs/graph-three.md` and the canonical package.
Wrap this in a `<Canvas>` and export `GraphScene` from `graph/GraphScene.tsx`; keep the canonical `GraphCanvas` name reserved for the package export.

---

## 6. Hand Model Stub

Replace with MediaPipe/TF.js when ready (in production, import `createTFJSHandModel` from `@spatial-ui-kit/handtracking-tfjs` instead of this stub).

```ts
// src/gestures/createTFJSHandModel.ts
import { HandModel } from "./HandTracker";
import { TrackedHand } from "./gestureTypes";

export async function createTFJSHandModel(): Promise<HandModel> {
  return {
    async estimateHands(_video: HTMLVideoElement): Promise<TrackedHand[]> {
      return []; // plug in MediaPipe or TF.js here
    },
  };
}
```

---

## 7. React Wiring

Hook everything together. `useGestureControl` options mirror the design spec (`model`, `onCommand`, `mapCursorToViewport`, `fps?`, `debug?`). Gesture clicks stay in `[0,1]` space and the hook rewrites `POINTER_CLICK` coordinates using `mapCursorToViewport`, so the local `GraphScene` stub can assume it already receives viewport-normalized values before converting to NDC. In production, swap this stub for `GraphCanvas` from `@spatial-ui-kit/graph-three`.

```tsx
// src/App.tsx
import React from "react";
import { GraphScene } from "./graph/GraphScene";
import { OrbitViewportController } from "./graph/OrbitViewportController";
import {
  GraphNode,
  GraphEdge,
  GestureClickNormalized,
  ViewportCommand,
} from "./graph/graphTypes";
import { useGestureControl } from "./gestures/useGestureControl";
import { createTFJSHandModel } from "./gestures/createTFJSHandModel";
import { HandModel } from "./gestures/HandTracker";

const dummyNodes: GraphNode[] = [
  { id: "a", position: [-5, 0, 0], data: { label: "A" } },
  { id: "b", position: [5, 0, 0], data: { label: "B" } },
  { id: "c", position: [0, 5, 0], data: { label: "C" } },
];

const dummyEdges: GraphEdge[] = [
  { id: "ab", source: "a", target: "b", data: {} },
  { id: "ac", source: "a", target: "c", data: {} },
  { id: "bc", source: "b", target: "c", data: {} },
];

export const App: React.FC = () => {
  const controllerRef = React.useRef(new OrbitViewportController());
  const [handModel, setHandModel] = React.useState<HandModel | null>(null);
  const [gestureClick, setGestureClick] =
    React.useState<GestureClickNormalized | null>(null);
  const gestureClickTokenRef = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    createTFJSHandModel()
      .then((model) => {
        if (!cancelled) setHandModel(model);
      })
      .catch((err) => console.error("Failed to init hand model", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCommand = React.useCallback((cmd: ViewportCommand) => {
    if (cmd.type === "POINTER_CLICK") {
      const token = ++gestureClickTokenRef.current;
      setGestureClick({ xNorm: cmd.xNorm, yNorm: cmd.yNorm, token });
      return;
    }
    controllerRef.current.handle(cmd);
  }, []);

  const { videoRef, overlayRef } = useGestureControl({
    model: handModel,
    onCommand: handleCommand,
    fps: 15, // optional throttling to save CPU
    mapCursorToViewport: React.useCallback((cursor) => cursor, []), // swap in a custom mapping when the canvas isn't fullscreen
    debug: true, // optional overlay info
  });

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#000",
      }}
    >
      <GraphScene
        controller={controllerRef.current}
        nodes={dummyNodes}
        edges={dummyEdges}
        onClickNode={(id) => console.log("Mouse click node", id)}
        gestureClick={gestureClick}
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
};
```

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 8. Next Steps

- Tune thresholds so single vs. double pinch feels crisp.
- Wire gesture clicks into your picker (the stubbed `GraphScene` already handles `{ xNorm, yNorm }` → raycast; the canonical version lives in `@spatial-ui-kit/graph-three`).
- Add a small HUD showing current gesture mode (ROTATE / PAN / ZOOM / CURSOR) + pinch debug info.
- Swap `dummyNodes`/`dummyEdges` for your real graph data once the backend exists.
