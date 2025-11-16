# @spatial-ui-kit/graph-core

## Purpose

A framework-neutral graph model: nodes, edges, metadata, and simple helpers. No UI, no rendering.

## Public API (v1)

```ts
// types.ts
export interface GraphNode<NodeData = unknown> {
  id: string;
  position: [number, number, number]; // layout coordinates
  data: NodeData; // domain-specific payload
}

export interface GraphEdge<EdgeData = unknown> {
  id: string;
  source: string; // node id
  target: string; // node id
  data: EdgeData;
}

export interface Graph<NodeData = unknown, EdgeData = unknown> {
  nodes: GraphNode<NodeData>[];
  edges: GraphEdge<EdgeData>[];
}

// helpers.ts
export function buildNodeIndex<N, E>(
  graph: Graph<N, E>
): Map<string, GraphNode<N>>;

export function getNeighbors<N, E>(
  graph: Graph<N, E>,
  nodeId: string
): GraphNode<N>[];

export function toAdjacencyList<N, E>(
  graph: Graph<N, E>
): Map<string, string[]>;

// (optional) simple layout stub
export interface LayoutOptions {
  iterations?: number;
  // more options later
}

export function applySimpleLayout<N, E>(
  graph: Graph<N, E>,
  options?: LayoutOptions
): Graph<N, E>; // returns new graph with updated positions
```

## Internal Structure

```
packages/graph-core/src/
  index.ts
  types.ts
  helpers.ts
  layout/simpleForceLayout.ts  # optional first-pass layout
```

## Interactions

- Apps construct graphs from their data (SoundCloud: artist metadata; other apps: files, APIs, etc.).
- graph-three reads nodes & edges to render.
- Layout helpers (if implemented) are called before handing graphs to the renderer.

## Extensibility

- Add more layout algorithms (force-directed, radial, hierarchical).
- Add clustering utilities (community detection, connected components).
- Add pathfinding helpers (shortest path, k-hop neighborhoods).
