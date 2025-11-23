import type {
  OrbitViewportConfig,
  OrbitViewportInertiaConfig,
  OrbitViewportState,
  ViewportCommand,
} from "./types";

type PerspectiveCameraLike = {
  position: { set: (x: number, y: number, z: number) => void };
  lookAt: (x: number, y: number, z: number) => void;
};

const DEFAULT_INERTIA: Required<OrbitViewportInertiaConfig> = {
  enabled: false,
  rotationFriction: 0.85,
  panFriction: 0.8,
  zoomFriction: 0.75,
};

const DEFAULT_CONFIG: Required<OrbitViewportConfig> = {
  radius: 40,
  minRadius: 5,
  maxRadius: 200,
  rotationSpeed: 0.01,
  panSpeed: 0.01,
  zoomSpeed: 0.1,
  inertia: DEFAULT_INERTIA,
};

function clampPhi(phi: number): number {
  const EPS = 1e-4;
  return Math.min(Math.max(phi, EPS), Math.PI - EPS);
}

function clampRadius(radius: number, minRadius: number, maxRadius: number): number {
  return Math.min(Math.max(radius, minRadius), maxRadius);
}

function mergeConfig(config?: OrbitViewportConfig): Required<OrbitViewportConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    inertia: {
      ...DEFAULT_INERTIA,
      ...(config?.inertia ?? {}),
    },
  };
}

export class OrbitViewportController {
  private config: Required<OrbitViewportConfig>;
  private state: OrbitViewportState;

  constructor(config?: OrbitViewportConfig) {
    this.config = mergeConfig(config);
    this.state = {
      radius: this.config.radius,
      theta: 0,
      phi: Math.PI / 2,
      panX: 0,
      panY: 0,
    };
  }

  handle(command: ViewportCommand): void {
    switch (command.type) {
      case "ROTATE":
        this.state.theta -= command.dx * this.config.rotationSpeed;
        this.state.phi = clampPhi(this.state.phi - command.dy * this.config.rotationSpeed);
        break;
      case "PAN":
        this.state.panX += command.dx * this.config.panSpeed;
        this.state.panY += command.dy * this.config.panSpeed;
        break;
      case "ZOOM":
        this.state.radius = clampRadius(
          this.state.radius * (1 - command.delta * this.config.zoomSpeed),
          this.config.minRadius,
          this.config.maxRadius
        );
        break;
      case "POINTER_CLICK":
        // Pointer clicks do not change camera state; handled by consumers.
        break;
      default:
        break;
    }
  }

  update(_dtSeconds: number): void {
    // Inertia is not implemented yet; placeholder for future integration.
    if (this.config.inertia.enabled) {
      return;
    }
  }

  applyToCamera(camera: PerspectiveCameraLike): void {
    const { panX, panY, radius, theta, phi } = this.state;
    const sinPhiRadius = Math.sin(phi) * radius;
    const x = panX + sinPhiRadius * Math.sin(theta);
    const y = panY + Math.cos(phi) * radius;
    const z = sinPhiRadius * Math.cos(theta);

    camera.position.set(x, y, z);
    camera.lookAt(panX, panY, 0);
  }

  getState(): OrbitViewportState {
    return { ...this.state };
  }
}

export { DEFAULT_CONFIG as defaultOrbitConfig };
