import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Mesh, SphereGeometry, MeshBasicMaterial } from "three";
import { convertNormalizedToNdc, raycastNodes } from "../src/internal/raycastUtils";
import type { GraphNode } from "@spatial-ui-kit/graph-core";

describe("convertNormalizedToNdc", () => {
  it("maps center to origin", () => {
    const ndc = convertNormalizedToNdc(0.5, 0.5);
    expect(ndc.x).toBeCloseTo(0);
    expect(ndc.y).toBeCloseTo(0);
  });

  it("maps corners correctly", () => {
    const ndc = convertNormalizedToNdc(0, 1);
    expect(ndc.x).toBeCloseTo(-1);
    expect(ndc.y).toBeCloseTo(-1);
  });
});

describe("raycastNodes", () => {
  it("returns intersected node", () => {
    const camera = new PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateWorldMatrix(true, true);

    const mesh = new Mesh(new SphereGeometry(1), new MeshBasicMaterial());
    mesh.position.set(0, 0, 0);
    mesh.geometry.computeBoundingSphere();
    mesh.updateWorldMatrix(true, true);
    const node: GraphNode = { id: "center", position: [0, 0, 0], data: {} };
    mesh.userData.graphNode = node;

    const ndc = convertNormalizedToNdc(0.5, 0.5);
    const stubRaycaster = {
      setFromCamera: () => {},
      intersectObjects: () => [{ object: mesh }] as any,
    };

    const hit = raycastNodes([mesh as any], ndc, camera, stubRaycaster as any);
    expect(hit?.id).toBe("center");
  });

  it("returns null when nothing hit", () => {
    const camera = new PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateWorldMatrix(true, true);

    const mesh = new Mesh(new SphereGeometry(1), new MeshBasicMaterial());
    mesh.position.set(5, 5, 0);
    mesh.geometry.computeBoundingSphere();
    mesh.updateWorldMatrix(true, true);
    mesh.userData.graphNode = { id: "miss", position: [5, 5, 0], data: {} };

    const ndc = convertNormalizedToNdc(0.5, 0.5);
    const stubRaycaster = {
      setFromCamera: () => {},
      intersectObjects: () => [],
    };

    const hit = raycastNodes([mesh as any], ndc, camera, stubRaycaster as any);
    expect(hit).toBeNull();
  });
});
