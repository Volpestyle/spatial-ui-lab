export type ViewportCommand =
  | { type: "PAN"; dx: number; dy: number }
  | { type: "ROTATE"; dx: number; dy: number }
  | { type: "ZOOM"; delta: number }
  | { type: "POINTER_CLICK"; xNorm: number; yNorm: number };

export interface OrbitViewportInertiaConfig {
  enabled?: boolean;
  rotationFriction?: number;
  panFriction?: number;
  zoomFriction?: number;
}

export interface OrbitViewportConfig {
  radius?: number;
  minRadius?: number;
  maxRadius?: number;
  rotationSpeed?: number;
  panSpeed?: number;
  zoomSpeed?: number;
  inertia?: OrbitViewportInertiaConfig;
  /**
   * When true, clamp vertical rotation to avoid flipping over the poles.
   * Set to false to allow upside-down views.
   * Default: true
   */
  clampVertical?: boolean;
}

export interface OrbitViewportState {
  radius: number;
  theta: number;
  phi: number;
  panX: number;
  panY: number;
}
