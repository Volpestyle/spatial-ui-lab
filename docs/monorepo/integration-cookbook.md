# Integration Cookbook

Shortest path to “first triangle” with gestures + graph rendering. Follow these steps verbatim for a new app; swap data and styling later.

## Use gestures with graph-three
1) Build your graph data
```ts
const graph: Graph<MyNode, MyEdge> = { nodes, edges };
```

2) Create a controller (enable inertia here if you want the default to feel “Google Earth”-ish)
```ts
const controller = new OrbitViewportController({
  inertia: { enabled: true }, // tweak friction per axis as needed
});
```

3) Initialize the hand model once
```ts
const [handModel, setHandModel] = useState<HandModel | null>(null);
useEffect(() => {
  let cancelled = false;
  createTFJSHandModel()
    .then((model) => !cancelled && setHandModel(model))
    .catch(console.error);
  return () => {
    cancelled = true;
  };
}, []);
```

4) Wire gestures → controller and capture normalized clicks
```ts
const [gestureClick, setGestureClick] = useState<{
  xNorm: number;
  yNorm: number;
  token: number;
} | null>(null);
const clickTokenRef = useRef(0);

const handleCommand = (cmd: ViewportCommand) => {
  if (cmd.type === "POINTER_CLICK") {
    setGestureClick({ ...cmd, token: ++clickTokenRef.current });
    return;
  }
  controller.handle(cmd);
};

const { videoRef, overlayRef } = useGestureControl({
  model: handModel,
  onCommand: handleCommand,
  mapCursorToViewport: (cursor) => cursor, // replace if the graph is inset or letterboxed
});
```

5) Render the graph
```tsx
<GraphCanvas
  graph={graph}
  controller={controller}
  gestureClick={gestureClick ?? undefined}
  onNodeClick={(node) => console.log("Hit node", node.id)}
/>
<canvas ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
<video ref={videoRef} style={{ position: "fixed", bottom: 0, right: 0, width: 160, opacity: 0.2 }} />
```

## Notes
- Imports: `GraphCanvas` from `@spatial-ui-kit/graph-three`, graph types from `@spatial-ui-kit/graph-core`, controller from `@spatial-ui-kit/control-core` (see `docs/types-index.md`).
- `GraphCanvas` expects `POINTER_CLICK` to already be viewport-normalized; do not remap clicks after `useGestureControl`.
- Gesture FPS can be lower than render FPS (`fps` option on `useGestureControl`); smoothing lives in gesture-core + control-core.
- Canonical APIs live in the design specs and package types; this cookbook is a wiring cheat sheet, not a replacement for the specs.
