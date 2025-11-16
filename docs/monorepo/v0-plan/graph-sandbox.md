# apps/graph-sandbox – sandbox app

Goal v0: A playground that proves the whole chain works.

- Create apps/graph-sandbox scaffold (Vite/Next/CRA)
- Install local package deps from workspaces
- Build a tiny static graph using graph-core
- Instantiate OrbitViewportController
- Render `<GraphCanvas>` with:
  - Static graph
  - Controller
  - onNodeClick logging node ID
- Add mouse-only controls first (optional)
- Wire gestures:
  - Load HandModel using createTFJSHandModel()
  - Use useGestureControl to feed ViewportCommands to controller
  - For POINTER_CLICK, convert norm to NDC and pass as gestureClick to GraphCanvas
- Manual QA:
  - Rotate/pan/zoom with gestures
  - Pinch-tap selects nodes
