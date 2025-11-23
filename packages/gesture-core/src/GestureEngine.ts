import type { ViewportCommand } from "@spatial-ui-kit/control-core";
import type {
  GestureDebugState,
  GestureEngineOptions,
  GestureMode,
  HandFrame,
} from "./types";

const DEFAULTS: Required<GestureEngineOptions> = {
  tapMaxDurationMs: 220,
  pinchIndexThreshold: 0.06,
  pinchMiddleThreshold: 0.07,
  rotationSensitivity: 200,
  panSensitivity: 100,
  zoomSensitivity: 5,
  moveDeadzone: 0.0015,
  zoomDeadzone: 0.001,
};

export class GestureEngine {
  private readonly options: Required<GestureEngineOptions>;
  private cursor: { x: number; y: number } = { x: 0.5, y: 0.5 };
  private mode: GestureMode = "IDLE";
  private primaryHand?: GestureDebugState["primaryHand"];

  constructor(opts?: GestureEngineOptions) {
    this.options = { ...DEFAULTS, ...(opts ?? {}) };
  }

  update(_frame: HandFrame): ViewportCommand[] {
    // Placeholder implementation; real gesture mapping will be added in Milestone 3.
    return [];
  }

  getCursor(): { x: number; y: number } {
    return { ...this.cursor };
  }

  getDebugState(): GestureDebugState {
    return { mode: this.mode, primaryHand: this.primaryHand };
  }
}

export { DEFAULTS as defaultGestureEngineOptions };
