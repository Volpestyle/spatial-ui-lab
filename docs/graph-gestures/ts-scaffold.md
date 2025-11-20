# TypeScript Scaffold

A gesture-driven 3D node graph scaffold you can adapt to any data source. Includes project structure, core types, hand tracking, gesture engine, controller/scene, and React wiring.

---

## 1. Project Structure

```

> For production, track consecutive pinched/not-pinched frames in `HandState` (or store the last N samples) so single/double pinch modes have hysteresis, and expose a `getDebugState()` helper for HUD overlays.
src/
  main.tsx            # React entrypoint
  App.tsx             # Root app
  graph/
    graphTypes.ts
    GraphController.ts
    GraphScene.tsx
  gestures/
    gestureTypes.ts
    HandTracker.ts
    GestureEngine.ts
    useGestureControl.ts
    createHandModel.ts # wrapper around MediaPipe/TF.js
```

---

## 2. Core Types

```ts
// src/graph/graphTypes.ts
export type GraphNode = {
  id: string;
  position: [number, number, number];
  label?: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type GraphMode = "normal" | "hotness" | "cluster";

export type ViewportCommand =
  | { type: "PAN"; dx: number; dy: number }
  | { type: "ROTATE"; dx: number; dy: number }
  | { type: "ZOOM"; delta: number }
  | { type: "POINTER_CLICK"; xNorm: number; yNorm: number }; // normalized [0,1], (0,0)=top-left

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
import { HandFrame, TrackedHand, Landmark } from "./gestureTypes";
import { ViewportCommand } from "../graph/graphTypes";

type EngineMode = "IDLE" | "ROTATE" | "PAN" | "ZOOM" | "CURSOR";

type HandState = {
  lastCenter?: { x: number; y: number };
  isSinglePinch: boolean;
  isDoublePinch: boolean;
  pinchActive: boolean;
  pinchStartTime: number | null;
};

type GestureEngineOptions = {
  tapMaxDurationMs?: number;
  pinchIndexThreshold?: number;
  pinchMiddleThreshold?: number;
  rotationSensitivity?: number;
  panSensitivity?: number;
  zoomSensitivity?: number;
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
    },
    Right: {
      isSinglePinch: false,
      isDoublePinch: false,
      pinchActive: false,
      pinchStartTime: null,
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

    if (!state.pinchActive && pinchIndex) {
      state.pinchActive = true;
      state.pinchStartTime = timestamp;
    } else if (!pinchIndex) {
      state.pinchActive = false;
      state.pinchStartTime = null;
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

    if (state.pinchActive && !pinchIndex && state.pinchStartTime != null) {
      const duration = timestamp - state.pinchStartTime;
      state.pinchActive = false;
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

```ts
// src/graph/GraphController.ts
import * as THREE from "three";
import { ViewportCommand } from "./graphTypes";

export class GraphController {
  private radius = 40;
  private theta = 0;
  private phi = Math.PI / 4;
  private panX = 0;
  private panY = 0;

  handleCommand(cmd: ViewportCommand) {
    switch (cmd.type) {
      case "ROTATE":
        this.theta -= cmd.dx * 0.01;
        this.phi -= cmd.dy * 0.01;
        this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi));
        break;
      case "PAN":
        this.panX += cmd.dx * 0.01;
        this.panY += cmd.dy * 0.01;
        break;
      case "ZOOM":
        this.radius *= 1 - cmd.delta * 0.1;
        this.radius = Math.max(5, Math.min(200, this.radius));
        break;
      case "POINTER_CLICK":
        break; // clicks are handled by the viewer (raycast)
    }
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
}
```

### Three.js scene (react-three-fiber)

```tsx
// src/graph/GraphScene.tsx
import React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GraphController } from "./GraphController";
import { GraphNode, GraphEdge, GestureClickNormalized } from "./graphTypes";

type GraphSceneProps = {
  controller: GraphController;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onClickNode?: (id: string) => void;
  gestureClick?: GestureClickNormalized | null;
};

const GraphSceneInner: React.FC<GraphSceneProps> = ({
  controller,
  nodes,
  edges,
  onClickNode,
  gestureClick,
}) => {
  const nodeRefs = React.useRef<Record<string, THREE.Mesh>>({});
  const raycasterRef = React.useRef(new THREE.Raycaster());
  const { camera } = useThree();

  useFrame(() => {
    controller.applyToCamera(camera as THREE.PerspectiveCamera);
  });

  React.useEffect(() => {
    if (!gestureClick || !onClickNode) return;
    const raycaster = raycasterRef.current;
    const ndcX = gestureClick.xNorm * 2 - 1;
    const ndcY = -(gestureClick.yNorm * 2 - 1);
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

    const meshes = Object.values(nodeRefs.current);
    if (!meshes.length) return;
    const intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      const entry = Object.entries(nodeRefs.current).find(
        ([, mesh]) => mesh === hit
      );
      if (entry) onClickNode(entry[0]);
    }
  }, [gestureClick, camera, onClickNode]);

  return (
    <group>
      {edges.map((edge) => {
        const source = nodes.find((n) => n.id === edge.source);
        const target = nodes.find((n) => n.id === edge.target);
        if (!source || !target) return null;

        const points = [
          new THREE.Vector3(...source.position),
          new THREE.Vector3(...target.position),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        return (
          <line key={edge.id} geometry={geometry}>
            <lineBasicMaterial />
          </line>
        );
      })}

      {nodes.map((node) => (
        <mesh
          key={node.id}
          position={node.position}
          ref={(ref) => {
            if (ref) {
              nodeRefs.current[node.id] = ref;
            } else {
              delete nodeRefs.current[node.id];
            }
          }}
          onClick={() => onClickNode?.(node.id)}
        >
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshStandardMaterial />
        </mesh>
      ))}

      <ambientLight />
      <directionalLight position={[10, 10, 10]} />
    </group>
  );
};

export const GraphCanvas: React.FC<GraphSceneProps> = (props) => (
  <Canvas camera={{ position: [0, 0, 50], fov: 60 }}>
    <GraphSceneInner {...props} />
  </Canvas>
);
```

> For larger graphs, memoize edge geometries instead of rebuilding them inside the render loop so raycasting stays fast.

---

## 6. Hand Model Stub

Replace with MediaPipe/TF.js when ready.

```ts
// src/gestures/createHandModel.ts
import { HandModel } from "./HandTracker";
import { TrackedHand } from "./gestureTypes";

export function createHandModel(): HandModel {
  return {
    async estimateHands(_video: HTMLVideoElement): Promise<TrackedHand[]> {
      return []; // plug in MediaPipe or TF.js here
    },
  };
}
```

---

## 7. React Wiring

Hook everything together. Gesture clicks stay in `[0,1]` space; `GraphCanvas` converts to NDC internally before raycasting.

```tsx
// src/App.tsx
import React from "react";
import { GraphCanvas } from "./graph/GraphScene";
import { GraphController } from "./graph/GraphController";
import {
  GraphNode,
  GraphEdge,
  GestureClickNormalized,
  ViewportCommand,
} from "./graph/graphTypes";
import { useGestureControl } from "./gestures/useGestureControl";
import { createHandModel } from "./gestures/createHandModel";

const dummyNodes: GraphNode[] = [
  { id: "a", position: [-5, 0, 0], label: "A" },
  { id: "b", position: [5, 0, 0], label: "B" },
  { id: "c", position: [0, 5, 0], label: "C" },
];

const dummyEdges: GraphEdge[] = [
  { id: "ab", source: "a", target: "b" },
  { id: "ac", source: "a", target: "c" },
  { id: "bc", source: "b", target: "c" },
];

export const App: React.FC = () => {
  const controllerRef = React.useRef(new GraphController());
  const [handModel, setHandModel] = React.useState(createHandModel());
  const [gestureClick, setGestureClick] =
    React.useState<GestureClickNormalized | null>(null);
  const gestureClickTokenRef = React.useRef(0);

  const handleCommand = React.useCallback((cmd: ViewportCommand) => {
    if (cmd.type === "POINTER_CLICK") {
      const token = ++gestureClickTokenRef.current;
      setGestureClick({ xNorm: cmd.xNorm, yNorm: cmd.yNorm, token });
      return;
    }
    controllerRef.current.handleCommand(cmd);
  }, []);

  const { videoRef, overlayRef } = useGestureControl({
    model: handModel,
    onCommand: handleCommand,
    mapCursorToViewport: React.useCallback((cursor) => cursor, []), // swap in a custom mapping when the canvas isn't fullscreen
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
      <GraphCanvas
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
- Wire gesture clicks into your picker (the scaffolded `GraphCanvas` already handles `{ xNorm, yNorm }` → raycast).
- Add a small HUD showing current gesture mode (ROTATE / PAN / ZOOM / CURSOR) + pinch debug info.
- Swap `dummyNodes`/`dummyEdges` for your real graph data once the backend exists.
