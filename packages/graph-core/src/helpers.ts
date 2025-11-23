import type { Graph, GraphEdge, GraphNode } from "./types";

export interface GraphIndex<N = unknown, E = unknown> {
  nodeById: Map<string, GraphNode<N>>;
  edgesByNode: Map<string, GraphEdge<E>[]>;
}

export function buildGraphIndex<N, E>(graph: Graph<N, E>): GraphIndex<N, E> {
  const nodeById = new Map<string, GraphNode<N>>();
  for (const node of graph.nodes) {
    if (nodeById.has(node.id)) {
      throw new Error(`Duplicate node id: ${node.id}`);
    }
    nodeById.set(node.id, node);
  }

  const edgesByNode = new Map<string, GraphEdge<E>[]>();
  for (const edge of graph.edges) {
    if (!nodeById.has(edge.source)) {
      throw new Error(`Edge ${edge.id} missing source node ${edge.source}`);
    }
    if (!nodeById.has(edge.target)) {
      throw new Error(`Edge ${edge.id} missing target node ${edge.target}`);
    }

    edgesByNode.set(edge.source, [...(edgesByNode.get(edge.source) ?? []), edge]);
    edgesByNode.set(edge.target, [...(edgesByNode.get(edge.target) ?? []), edge]);
  }

  return { nodeById, edgesByNode };
}
