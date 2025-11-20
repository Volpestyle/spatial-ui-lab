# Gesture Pointer Click to 3D Node Selection

Wire `ViewportCommand.POINTER_CLICK { xNorm, yNorm }` (normalized `[0,1]`) into your Three.js scene so pinch taps hit nodes.

---

## 1. Add a Gesture Click Prop to the Graph Scene
Pass a normalized device coordinate (NDC) click into the canvas.

```ts
// src/graph/graphTypes.ts
export type ViewportCommand =
  | { type: "PAN"; dx: number; dy: number }
  | { type: "ROTATE"; dx: number; dy: number }
  | { type: "ZOOM"; delta: number }
  | { type: "POINTER_CLICK"; xNorm: number; yNorm: number };

export type GestureClickNormalized = {
  xNorm: number; // [0,1], top-left origin
  yNorm: number;
  token: number; // increment each click to retrigger effects
};
```

---

## 2. Update the 3D Graph to Raycast on Gesture Clicks
Track node mesh refs and raycast when the gesture click changes.

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
      const hitId =
        Object.entries(nodeRefs.current).find(([, mesh]) => mesh === hit)?.[0] ?? null;
      if (hitId) onClickNode(hitId);
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

Key points:
- `gestureClick` carries normalized `[0,1]` coordinates and a token so repeated clicks at the same spot still trigger the effect.
- The scene converts `{ xNorm, yNorm }` to NDC internally before raycasting.
- Mouse clicks are still supported via `onClick` on the mesh.

---

## 3. Handle `POINTER_CLICK` commands in the app
Store normalized clicks and pass them to the canvas; the scene converts to NDC internally.

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
import { HandModel } from "./gestures/HandTracker";

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
  const [handModel, setHandModel] = React.useState<HandModel | null>(null);
  const [gestureClick, setGestureClick] =
    React.useState<GestureClickNormalized | null>(null);
  const gestureClickTokenRef = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    createHandModel()
      .then((model) => {
        if (!cancelled) setHandModel(model);
      })
      .catch((err) => {
        console.error("Failed to init hand model", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCommand = React.useCallback((cmd: ViewportCommand) => {
    if (cmd.type === "POINTER_CLICK") {
      const token = ++gestureClickTokenRef.current;
      setGestureClick({
        xNorm: cmd.xNorm,
        yNorm: cmd.yNorm,
        token,
      });
      return; // clicks are routed to GraphCanvas, not the camera
    }

    controllerRef.current.handleCommand(cmd);
  }, []);

  const { videoRef, overlayRef } = useGestureControl({
    model: handModel,
    onCommand: handleCommand,
    mapCursorToViewport: React.useCallback((cursor) => cursor, []),
  });

  const handleNodeClick = React.useCallback((id: string) => {
    console.log("Node clicked (mouse or gesture):", id);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#000" }}>
      <GraphCanvas
        controller={controllerRef.current}
        nodes={dummyNodes}
        edges={dummyEdges}
        onClickNode={handleNodeClick}
        gestureClick={gestureClick}
      />

      <canvas
        ref={overlayRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      <video
        ref={videoRef}
        style={{ position: "fixed", bottom: 0, right: 0, width: 160, opacity: 0.2 }}
        muted
        playsInline
      />
    </div>
  );
};
```

Flow:
- Gesture engine emits `POINTER_CLICK` with normalized `[0,1]` coordinates.
- App stores the normalized click (plus a token) and passes it to `<GraphCanvas>`.
- `GraphCanvas` converts to NDC, raycasts, and calls `onClickNode(nodeId)` just like mouse clicks.

---

## 4. Next Steps
- Add a selected-node state and highlight logic.
- Show a HUD for current gesture mode and pinch status to help tuning.
- Swap dummy data for your real graph; the gesture → click plumbing stays the same.
