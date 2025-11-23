import React from "react";
import { Canvas } from "@react-three/fiber";
import type { Graph, GraphEdge, GraphNode } from "@spatial-ui-kit/graph-core";
import type { OrbitViewportController } from "@spatial-ui-kit/control-core";
import { GraphScene } from "./internal/GraphScene";

export interface GestureClickNormalized {
  xNorm: number;
  yNorm: number;
  token: number;
}

export type GraphCanvasProps<N = unknown, E = unknown> = {
  graph: Graph<N, E>;
  controller: OrbitViewportController;
  onNodeClick?: (node: GraphNode<N>) => void;
  onNodeHover?: (node: GraphNode<N> | null) => void;
  gestureClick?: GestureClickNormalized;
  renderNode?: (node: GraphNode<N>) => React.ReactNode;
  renderEdge?: (edge: GraphEdge<E>) => React.ReactNode;
  nodeRadius?: number;
  showEdges?: boolean;
};

export function GraphCanvas<N, E>(props: GraphCanvasProps<N, E>): JSX.Element {
  const {
    graph,
    controller,
    onNodeClick,
    onNodeHover,
    gestureClick,
    renderNode,
    renderEdge,
    nodeRadius,
    showEdges,
  } = props;

  return (
    <Canvas
      camera={{ position: [0, 0, 40], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <GraphScene
        graph={graph}
        controller={controller}
        onNodeClick={onNodeClick}
        onNodeHover={onNodeHover}
        gestureClick={gestureClick}
        renderNode={renderNode}
        renderEdge={renderEdge}
        nodeRadius={nodeRadius}
        showEdges={showEdges}
      />
    </Canvas>
  );
}
