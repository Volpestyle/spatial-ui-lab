import * as THREE from "three";
import type { GraphNode } from "@spatial-ui-kit/graph-core";

export function convertNormalizedToNdc(xNorm: number, yNorm: number): THREE.Vector2 {
  return new THREE.Vector2(xNorm * 2 - 1, -(yNorm * 2 - 1));
}

type MeshWithNode<N> = THREE.Mesh & { userData: { graphNode?: GraphNode<N> } };

export function raycastNodes<N>(
  meshes: MeshWithNode<N>[],
  ndc: THREE.Vector2,
  camera: THREE.PerspectiveCamera,
  raycaster: THREE.Raycaster = new THREE.Raycaster()
): GraphNode<N> | null {
  if (!meshes.length) return null;
  raycaster.setFromCamera(ndc, camera);
  const intersections = raycaster.intersectObjects(meshes, false);
  const hit = intersections.find((i) => Boolean((i.object as MeshWithNode<N>).userData.graphNode));
  return hit ? (hit.object as MeshWithNode<N>).userData.graphNode ?? null : null;
}
