import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Graph, GraphEdge, GraphNode } from "@spatial-ui-kit/graph-core";
import type { OrbitViewportController } from "@spatial-ui-kit/control-core";
import * as THREE from "three";
import { EdgeLine } from "./EdgeLine";
import { NodeMesh } from "./NodeMesh";
import { convertNormalizedToNdc, raycastNodes } from "./raycastUtils";
import type { GestureClickNormalized } from "../GraphCanvas";

interface GraphSceneProps<N = unknown, E = unknown> {
  graph: Graph<N, E>;
  controller: OrbitViewportController;
  onNodeClick?: (node: GraphNode<N>) => void;
  onNodeHover?: (node: GraphNode<N> | null) => void;
  gestureClick?: GestureClickNormalized;
  renderNode?: (node: GraphNode<N>) => React.ReactNode;
  renderEdge?: (edge: GraphEdge<E>) => React.ReactNode;
  nodeRadius?: number;
  showEdges?: boolean;
}

type MeshWithNode<N> = THREE.Mesh & { userData: { graphNode: GraphNode<N> } };

export function GraphScene<N, E>(props: GraphSceneProps<N, E>) {
  const {
    graph,
    controller,
    onNodeClick,
    onNodeHover,
    gestureClick,
    renderNode,
    renderEdge,
    nodeRadius = 1,
    showEdges = true,
  } = props;

  const { camera } = useThree();
  const nodesRef = useRef<Record<string, MeshWithNode<N> | null>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const lastGestureToken = useRef<number | null>(null);

  const nodeById = useMemo(() => {
    const map = new Map<string, GraphNode<N>>();
    graph.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [graph.nodes]);

  useEffect(() => {
    controller.applyToCamera(camera as THREE.PerspectiveCamera);
  }, [camera, controller]);

  useFrame((state, delta) => {
    controller.update(delta);
    controller.applyToCamera(state.camera as THREE.PerspectiveCamera);
  });

  useEffect(() => {
    if (!gestureClick || gestureClick.token === lastGestureToken.current) return;
    lastGestureToken.current = gestureClick.token;
    if (!onNodeClick) return;

    const meshes = Object.values(nodesRef.current).filter(Boolean) as MeshWithNode<N>[];
    const ndc = convertNormalizedToNdc(gestureClick.xNorm, gestureClick.yNorm);
    const hit = raycastNodes(meshes, ndc, camera as THREE.PerspectiveCamera);
    if (hit) {
      onNodeClick(hit);
    }
  }, [camera, gestureClick, onNodeClick]);

  return (
    <>
      {showEdges &&
        graph.edges.map((edge) => {
          if (renderEdge) return renderEdge(edge);
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);
          if (!source || !target) return null;
          return (
            <EdgeLine
              key={edge.id}
              edge={edge}
              sourcePosition={source.position as [number, number, number]}
              targetPosition={target.position as [number, number, number]}
            />
          );
        })}
      {graph.nodes.map((node) => {
        if (renderNode) return renderNode(node);
        return (
          <NodeMesh
            key={node.id}
            node={node}
            radius={nodeRadius}
            ref={(mesh) => {
              nodesRef.current[node.id] = mesh as MeshWithNode<N> | null;
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onNodeClick?.(node);
            }}
            onPointerOver={(event) => {
              event.stopPropagation();
              if (node.id !== hoveredId) {
                setHoveredId(node.id);
                onNodeHover?.(node);
              }
            }}
            onPointerOut={(event) => {
              event.stopPropagation();
              if (hoveredId !== null) {
                setHoveredId(null);
                onNodeHover?.(null);
              }
            }}
          />
        );
      })}
    </>
  );
}
