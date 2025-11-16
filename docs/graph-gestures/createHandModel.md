# Gesture Click to 3D Node Selection

Wire the gesture `CLICK_AT(x, y)` (normalized `[0,1]`) into your Three.js scene so pinch taps hit nodes.

---

## 1. Add a Gesture Click Prop to the Graph Scene
Pass a normalized device coordinate (NDC) click into the canvas.

```ts
// src/graph/graphTypes.ts
export type GraphCommand =
  | { type: "PAN"; dx: number; dy: number }
  | { type: "ROTATE"; dx: number; dy: number }
  | { type: "ZOOM"; delta: number }
  | { type: "CLICK_AT"; x: number; y: number };

export type GestureClickNDC = {
  x: number; // [-1, 1]
  y: number; // [-1, 1]
  token: number; // unique id per click
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
import { GraphNode, GraphEdge, GestureClickNDC } from "./graphTypes";

type GraphSceneProps = {
  controller: GraphController;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onClickNode?: (id: string) => void;
  gestureClick?: GestureClickNDC | null;
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
    raycaster.setFromCamera({ x: gestureClick.x, y: gestureClick.y }, camera);

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
            if (ref) nodeRefs.current[node.id] = ref;
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
- `gestureClick` prop carries NDC and a token so React effects fire per click.
- Effect raycasts from camera through NDC coords and maps hit mesh → node id.
- Mouse clicks are still supported via `onClick` on the mesh.

---

## 3. Convert Gesture `CLICK_AT` ([0,1]) → NDC in the App
Handle the conversion and store a tokened NDC click for the scene to consume.

```tsx
// src/App.tsx
import React from "react";
import { GraphCanvas } from "./graph/GraphScene";
import { GraphController } from "./graph/GraphController";
import {
  GraphNode,
  GraphEdge,
  GraphCommand,
  GestureClickNDC,
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
  const [gestureClick, setGestureClick] = React.useState<GestureClickNDC | null>(null);
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

  const handleCommand = React.useCallback((cmd: GraphCommand) => {
    if (cmd.type === "CLICK_AT") {
      const ndcX = cmd.x * 2 - 1;
      const ndcY = -(cmd.y * 2 - 1);
      const token = ++gestureClickTokenRef.current;
      setGestureClick({ x: ndcX, y: ndcY, token });
      return; // do not feed CLICK_AT into camera controls
    }

    controllerRef.current.handleCommand(cmd);
  }, []);

  const { videoRef, overlayRef } = useGestureControl({
    model: handModel,
    onCommand: handleCommand,
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
- Gesture engine emits `CLICK_AT` with overlay coords `[0,1]`.
- App converts to NDC and increments `token` so a new click triggers raycast.
- `GraphCanvas` raycasts and calls `onClickNode(nodeId)`, same as mouse clicks.

---

## 4. Next Steps
- Add a selected-node state and highlight logic.
- Show a HUD for current gesture mode and pinch status to help tuning.
- Swap dummy data for your real graph; the gesture → click plumbing stays the same.
