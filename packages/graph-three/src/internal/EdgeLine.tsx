import React, { useMemo } from "react";
import type { GraphEdge } from "@spatial-ui-kit/graph-core";
import * as THREE from "three";

export interface EdgeLineProps<E = unknown> {
  edge: GraphEdge<E>;
  sourcePosition: [number, number, number];
  targetPosition: [number, number, number];
}

export function EdgeLine<E>({ edge, sourcePosition, targetPosition }: EdgeLineProps<E>) {
  const positions = useMemo(
    () => new Float32Array([...sourcePosition, ...targetPosition]),
    [sourcePosition, targetPosition]
  );

  return (
    <line userData={{ edgeId: edge.id }}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={2}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#99aab5" linewidth={1} />
    </line>
  );
}
