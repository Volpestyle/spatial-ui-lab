import React from "react";
import type { Graph, GraphEdge, GraphNode } from "@spatial-ui-kit/graph-core";
import type { OrbitViewportController } from "@spatial-ui-kit/control-core";

export type GraphCanvasProps<N = unknown, E = unknown> = {
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

export function GraphCanvas<N, E>(props: GraphCanvasProps<N, E>): JSX.Element {
  // Placeholder component until Three.js renderer is implemented.
  const { graph } = props;

  return (
    <div style={{ padding: "0.5rem", fontSize: "0.875rem" }}>
      <strong>GraphCanvas placeholder</strong>
      <div>{graph.nodes.length} nodes</div>
      <div>{graph.edges.length} edges</div>
    </div>
  );
}
