import { describe, expect, it } from "vitest";
import type { Graph } from "../src";
import { buildGraphIndex } from "../src";

describe("buildGraphIndex", () => {
  const graph: Graph = {
    nodes: [
      { id: "a", position: [0, 0, 0], data: {} },
      { id: "b", position: [1, 0, 0], data: {} },
    ],
    edges: [{ id: "ab", source: "a", target: "b", data: {} }],
  };

  it("returns node and edge maps", () => {
    const index = buildGraphIndex(graph);
    expect(index.nodeById.get("a")?.id).toBe("a");
    expect(index.edgesByNode.get("a")?.[0].id).toBe("ab");
    expect(index.edgesByNode.get("b")?.[0].id).toBe("ab");
  });

  it("throws on missing node references", () => {
    const badGraph: Graph = {
      nodes: [{ id: "a", position: [0, 0, 0], data: {} }],
      edges: [{ id: "ax", source: "a", target: "missing", data: {} }],
    };
    expect(() => buildGraphIndex(badGraph)).toThrow(/missing target node/);
  });
});
