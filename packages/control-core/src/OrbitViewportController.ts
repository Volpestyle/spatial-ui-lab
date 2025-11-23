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
  private rotationVelocity = { theta: 0, phi: 0 };
  private panVelocity = { x: 0, y: 0 };
  private zoomVelocity = 0;

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
    if (this.config.inertia.enabled) {
      this.handleWithInertia(command);
      return;
    }

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
    if (!this.config.inertia.enabled) {
      return;
    }

    const dt = _dtSeconds;
    if (dt <= 0) return;

    this.state.theta += this.rotationVelocity.theta * dt;
    this.state.phi = clampPhi(this.state.phi + this.rotationVelocity.phi * dt);

    this.state.panX += this.panVelocity.x * dt;
    this.state.panY += this.panVelocity.y * dt;

    const logRadius = Math.log(this.state.radius);
    const nextLogRadius = logRadius - this.zoomVelocity * dt;
    this.state.radius = clampRadius(Math.exp(nextLogRadius), this.config.minRadius, this.config.maxRadius);

    const inertia = this.config.inertia;
    const rotationFriction = inertia.rotationFriction ?? DEFAULT_INERTIA.rotationFriction;
    const panFriction = inertia.panFriction ?? DEFAULT_INERTIA.panFriction;
    const zoomFriction = inertia.zoomFriction ?? DEFAULT_INERTIA.zoomFriction;

    this.rotationVelocity.theta *= Math.pow(rotationFriction, dt);
    this.rotationVelocity.phi *= Math.pow(rotationFriction, dt);
    this.panVelocity.x *= Math.pow(panFriction, dt);
    this.panVelocity.y *= Math.pow(panFriction, dt);
    this.zoomVelocity *= Math.pow(zoomFriction, dt);

    this.zeroOutTinyVelocities();
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

  private handleWithInertia(command: ViewportCommand): void {
    switch (command.type) {
      case "ROTATE":
        this.rotationVelocity.theta -= command.dx * this.config.rotationSpeed;
        this.rotationVelocity.phi -= command.dy * this.config.rotationSpeed;
        break;
      case "PAN":
        this.panVelocity.x += command.dx * this.config.panSpeed;
        this.panVelocity.y += command.dy * this.config.panSpeed;
        break;
      case "ZOOM":
        this.zoomVelocity += command.delta * this.config.zoomSpeed;
        break;
      case "POINTER_CLICK":
      default:
        break;
    }
  }

  private zeroOutTinyVelocities(): void {
    const EPS = 1e-5;
    if (Math.abs(this.rotationVelocity.theta) < EPS) this.rotationVelocity.theta = 0;
    if (Math.abs(this.rotationVelocity.phi) < EPS) this.rotationVelocity.phi = 0;
    if (Math.abs(this.panVelocity.x) < EPS) this.panVelocity.x = 0;
    if (Math.abs(this.panVelocity.y) < EPS) this.panVelocity.y = 0;
    if (Math.abs(this.zoomVelocity) < EPS) this.zoomVelocity = 0;
  }
}

export { DEFAULT_CONFIG as defaultOrbitConfig };
