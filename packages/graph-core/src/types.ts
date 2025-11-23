export type Vec3 = [number, number, number];

export interface GraphNode<N = unknown> {
  id: string;
  position: Vec3;
  data: N;
}

export interface GraphEdge<E = unknown> {
  id: string;
  source: string;
  target: string;
  data: E;
}

export interface Graph<N = unknown, E = unknown> {
  nodes: GraphNode<N>[];
  edges: GraphEdge<E>[];
}
