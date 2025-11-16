# @spatial-ui-kit/graph-core – graph data & helpers

Goal v0: Graph types + trivial helpers (no heavy layout yet).

- Create package skeleton
  - packages/graph-core/package.json
  - src/index.ts
  - src/types.ts
  - src/helpers.ts
- Define types in types.ts
  - GraphNode<Data> with id, position, data
  - GraphEdge<Data> with id, source, target, data
  - Graph<NodeData, EdgeData> with nodes, edges
- Implement helpers in helpers.ts
  - buildNodeIndex(graph)
  - getNeighbors(graph, nodeId)
  - toAdjacencyList(graph)
  - (Optional v0) Simple layout placeholder
    - applySimpleLayout(graph) that just spreads nodes in a circle or line
- Basic tests
  - buildNodeIndex returns correct map
  - getNeighbors returns neighbors by edges
- Export from index.ts
