import React, { forwardRef } from "react";
import type { MeshProps } from "@react-three/fiber";
import type { GraphNode } from "@spatial-ui-kit/graph-core";
import * as THREE from "three";

export type NodeMeshProps<N = unknown> = MeshProps & {
  node: GraphNode<N>;
  radius: number;
};

export const NodeMesh = forwardRef<THREE.Mesh, NodeMeshProps>(function NodeMesh(
  { node, radius, ...rest },
  ref
) {
  return (
    <mesh
      ref={ref}
      position={node.position as unknown as [number, number, number]}
      userData={{ graphNode: node }}
      {...rest}
    >
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial color="#66ccff" />
    </mesh>
  );
});
