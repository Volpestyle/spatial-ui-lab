import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { GraphCanvas } from "@spatial-ui-kit/graph-three";
import { OrbitViewportController, type ViewportCommand } from "@spatial-ui-kit/control-core";
import type { Graph } from "@spatial-ui-kit/graph-core";
import { useGestureControl } from "@spatial-ui-kit/gesture-react";
import { createTFJSHandModel, type HandModel } from "@spatial-ui-kit/handtracking-tfjs";

import "./style.css";

type NodeData = { label?: string };
type EdgeData = Record<string, never>;

type GestureClick = { xNorm: number; yNorm: number; token: number };

const sampleGraph: Graph<NodeData, EdgeData> = {
  nodes: [
    { id: "a", position: [-4, 0, 0], data: { label: "Alpha" } },
    { id: "b", position: [4, 0, 0], data: { label: "Beta" } },
    { id: "c", position: [0, 4, 0], data: { label: "Gamma" } },
    { id: "d", position: [0, -4, 0], data: { label: "Delta" } },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", data: {} },
    { id: "ac", source: "a", target: "c", data: {} },
    { id: "ad", source: "a", target: "d", data: {} },
    { id: "bc", source: "b", target: "c", data: {} },
    { id: "bd", source: "b", target: "d", data: {} },
  ],
};

function useHandModel(enabled: boolean) {
  const [model, setModel] = useState<HandModel | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setModel(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    createTFJSHandModel()
      .then((m) => {
        if (!cancelled) {
          setModel(m);
          setStatus("ready");
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { model, status };
}

function App() {
  const controller = useMemo(() => new OrbitViewportController({ inertia: { enabled: true } }), []);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const { model, status } = useHandModel(gestureEnabled);
  const gestureTokenRef = useRef(0);
  const [gestureClick, setGestureClick] = useState<GestureClick | null>(null);
  const [lastNode, setLastNode] = useState<string | null>(null);

  const handleCommand = (cmd: ViewportCommand) => {
    if (cmd.type === "POINTER_CLICK") {
      const token = ++gestureTokenRef.current;
      setGestureClick({ xNorm: cmd.xNorm, yNorm: cmd.yNorm, token });
      return;
    }
    controller.handle(cmd);
  };

  const { videoRef, overlayRef } = useGestureControl({
    model,
    onCommand: handleCommand,
    mapCursorToViewport: (cursor) => cursor,
    fps: 20,
    debug: true,
    onError: (err) => console.error("Gesture error", err),
  });

  return (
    <div className="app">
      <header className="hud">
        <div>
          <strong>Graph Sandbox</strong>
          <div className="sub">Rotate/Pan/Zoom with mouse; enable gestures to tap nodes.</div>
        </div>
        <div className="controls">
          <button onClick={() => setGestureEnabled((v) => !v)}>
            {gestureEnabled ? "Disable gestures" : "Enable gestures"}
          </button>
          <span className="status">Model: {status}</span>
          {lastNode && <span className="status">Last node: {lastNode}</span>}
        </div>
      </header>

      <div className="canvas-wrapper">
        <GraphCanvas
          graph={sampleGraph}
          controller={controller}
          gestureClick={gestureClick ?? undefined}
          onNodeClick={(node) => setLastNode(node.id)}
          onNodeHover={() => undefined}
        />
        <canvas ref={overlayRef} className="overlay" />
        <video ref={videoRef} className="video-thumb" muted playsInline />
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
