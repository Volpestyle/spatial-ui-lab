# Gesture Pointer Click to 3D Node Selection

Wire `ViewportCommand.POINTER_CLICK { xNorm, yNorm }` (normalized `[0,1]`) into your Three.js scene so pinch taps hit nodes.

> Canonical click handling ships with `@spatial-ui-kit/graph-three`’s `GraphCanvas(graph, controller, gestureClick, …)`. Types live in the packages (`docs/types-index.md`). This doc shows the minimum plumbing and raycast snippet; keep your real implementation in `graph-three`.

---

## Preferred: use GraphCanvas (canonical)
Store the normalized click and pass it through unchanged; `GraphCanvas` converts to NDC internally and shares the mouse/gesture raycast path.

```tsx
import { useRef, useState, useCallback } from "react";
import { GraphCanvas } from "@spatial-ui-kit/graph-three";
import { OrbitViewportController, ViewportCommand } from "@spatial-ui-kit/control-core";

const controller = new OrbitViewportController();
const [gestureClick, setGestureClick] = useState<{ xNorm: number; yNorm: number; token: number }>();
const clickTokenRef = useRef(0);

const handleCommand = useCallback((cmd: ViewportCommand) => {
  if (cmd.type === "POINTER_CLICK") {
    setGestureClick({ ...cmd, token: ++clickTokenRef.current });
    return;
  }
  controller.handle(cmd);
}, []);
```

Pass `gestureClick` into `<GraphCanvas gestureClick={gestureClick} />` along with your graph and controller.

---

## Rolling your own R3F scene (GraphScene)
If you need a custom scene, convert `[0,1]` clicks to NDC right before raycasting. Call the component `GraphScene` (not `GraphCanvas`) to avoid colliding with the canonical API name.

```tsx
const raycaster = useMemo(() => new THREE.Raycaster(), []);

useEffect(() => {
  if (!gestureClick || !onClickNode) return;

  const ndcX = gestureClick.xNorm * 2 - 1;
  const ndcY = -(gestureClick.yNorm * 2 - 1);
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

  const intersects = raycaster.intersectObjects(nodeMeshes, false);
  const hit = intersects[0];
  if (hit) {
    const nodeId = meshIdLookup.get(hit.object);
    if (nodeId) onClickNode(nodeId);
  }
}, [gestureClick, camera, onClickNode, nodeMeshes, meshIdLookup, raycaster]);
```

---

## References
- Canonical renderer: `docs/monorepo/design-specs/graph-three.md`
- Gesture pipeline overview: `docs/graph-gestures/gesture-definitions.md`
