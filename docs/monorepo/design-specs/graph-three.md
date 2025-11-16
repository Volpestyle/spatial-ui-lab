# @spatial-ui-kit/graph-three

## Purpose

A React + Three.js 3D graph viewer that:
- Takes a Graph from graph-core.
- Uses a ViewportController from control-core.
- Provides hooks for clicking/hovering nodes.
- Optionally accepts pointer click events from gestures.

## Public API (v1)

```ts
import { Graph, GraphNode, GraphEdge } from "@spatial-ui-kit/graph-core";
import { OrbitViewportController } from "@spatial-ui-kit/control-core";

export interface GestureClickNormalized {
  xNorm: number; // [0,1] viewport coords
  yNorm: number; // [0,1]
  token: number; // unique per click
}

export interface GraphCanvasProps<NodeData = unknown, EdgeData = unknown> {
  graph: Graph<NodeData, EdgeData>;
  controller: OrbitViewportController;

  onNodeClick?: (node: GraphNode<NodeData>) => void;
  onNodeHover?: (node: GraphNode<NodeData> | null) => void;

  // Optional pointer click from external input (e.g. gesture)
  gestureClick?: GestureClickNormalized;

  // Custom renderers
  renderNode?: (node: GraphNode<NodeData>) => React.ReactNode;
  renderEdge?: (edge: GraphEdge<EdgeData>) => React.ReactNode;

  // Optional: rendering options (node size, edge thickness, etc.)
  nodeRadius?: number;
  showEdges?: boolean;
}

export const GraphCanvas: <N, E>(
  props: GraphCanvasProps<N, E>
) => JSX.Element;
```

## Behavior & Data Flow

- Uses @react-three/fiber’s `<Canvas>` under the hood.
- Each frame:
  - Calls controller.applyToCamera(camera).
  - Renders:
    - Default node: `<mesh><sphereGeometry /><meshStandardMaterial /></mesh>`
    - Default edge: `<line>` between node positions.
    - If renderNode / renderEdge provided, use those instead.
- Node interaction:
  - For mouse: use R3F onPointerDown/Move on meshes to detect hover & clicks.
  - For gesture:
    - gestureClick effect:
      - Convert xNorm,yNorm to NDC:
        - ndcX = xNorm * 2 - 1
        - ndcY = -(yNorm * 2 - 1)
      - Use Raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera).
      - Intersect node meshes, map back to GraphNode, call onNodeClick.

## Internal Structure

```
packages/graph-three/src/
  index.ts
  GraphCanvas.tsx
  internal/
    GraphScene.tsx   # inner R3F scene component
    NodeMesh.tsx     # default node renderer
    EdgeLine.tsx     # default edge renderer
    raycastUtils.ts  # shared raycasting logic
```

## Extensibility

- Swappable camera controller (you can pass in any controller implementing applyToCamera).
- Style/shape overrides via renderNode / renderEdge.
- Future: labels, sprites, billboards; level-of-detail strategies for large graphs; “cluster hulls” for communities.
