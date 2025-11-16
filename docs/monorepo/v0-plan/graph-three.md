# @spatial-ui-kit/graph-three – 3D graph renderer

Goal v0: `<GraphCanvas>` rendering a toy graph with mouse clicks.

- Create package skeleton
  - packages/graph-three/package.json
  - Install deps: react, react-dom, three, @react-three/fiber
  - src/index.ts
  - src/GraphCanvas.tsx
  - src/internal/GraphScene.tsx
- Define props
  - GraphCanvasProps<N, E> including:
    - graph: Graph<N, E>
    - controller: OrbitViewportController
    - onNodeClick?, onNodeHover?
    - gestureClick? { xNorm, yNorm, token }
    - renderNode?, renderEdge?
    - Optional visual config (nodeRadius, showEdges)
- Implement GraphCanvas
  - Wrap `<Canvas>` from @react-three/fiber
  - Render GraphSceneInner passing props
- Implement GraphSceneInner
  - In useFrame, call controller.applyToCamera(camera)
  - Render edges: map edges to `<line>` segments (or via a simple component)
  - Render nodes:
    - Use renderNode if provided
    - Else default `<mesh><sphereGeometry /><meshStandardMaterial /></mesh>`
  - Keep a ref map nodeId → mesh for raycasting
  - Attach onPointerDown to support mouse click
- Implement gesture click effect
  - On gestureClick change:
    - Convert xNorm,yNorm → NDC
    - Raycast from camera into node meshes
    - If hit, call onNodeClick
- Simple tests/smoke checks
  - Type-level test: component accepts generic node/edge data
  - Manual visual test in sandbox app
- Export from index.ts
