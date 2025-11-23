import React from "react";
import { createRoot } from "react-dom/client";
import { GraphCanvas } from "@spatial-ui-kit/graph-three";
import { OrbitViewportController } from "@spatial-ui-kit/control-core";
import type { Graph } from "@spatial-ui-kit/graph-core";

type NodeData = { label?: string };
type EdgeData = Record<string, never>;

const graph: Graph<NodeData, EdgeData> = {
  nodes: [
    { id: "a", position: [-2, 0, 0], data: { label: "A" } },
    { id: "b", position: [2, 0, 0], data: { label: "B" } },
    { id: "c", position: [0, 3, 0], data: { label: "C" } },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", data: {} },
    { id: "ac", source: "a", target: "c", data: {} },
    { id: "bc", source: "b", target: "c", data: {} },
  ],
};

const controller = new OrbitViewportController();

export function App() {
  return <GraphCanvas graph={graph} controller={controller} />;
}

if (typeof document !== "undefined") {
  const rootEl = document.getElementById("root");
  if (rootEl) {
    createRoot(rootEl).render(<App />);
  }
}
