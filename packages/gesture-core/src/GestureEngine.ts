import type { ViewportCommand } from "@spatial-ui-kit/control-core";
import type {
  GestureDebugState,
  GestureEngineOptions,
  GestureMode,
  HandFrame,
  Handedness,
  Landmark,
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

type HandRuntimeState = {
  pinchIndexActive: boolean;
  pinchMiddleActive: boolean;
  pinchStartTime?: number;
  lastCenter?: { x: number; y: number };
};

type ProcessedHand = {
  handedness: Handedness;
  center: { x: number; y: number };
  indexTip: { x: number; y: number };
  pinchIndex: boolean;
  pinchMiddle: boolean;
};

export class GestureEngine {
  private readonly options: Required<GestureEngineOptions>;
  private cursor: { x: number; y: number } = { x: 0.5, y: 0.5 };
  private mode: GestureMode = "IDLE";
  private primaryHand?: GestureDebugState["primaryHand"];
  private handStates = new Map<Handedness, HandRuntimeState>();
  private lastZoomDistance: number | null = null;

  constructor(opts?: GestureEngineOptions) {
    this.options = { ...DEFAULTS, ...(opts ?? {}) };
  }

  update(frame: HandFrame): ViewportCommand[] {
    const commands: ViewportCommand[] = [];
    const processed = frame.hands.map((hand) => this.processHand(hand));

    if (processed.length === 0) {
      this.mode = "IDLE";
      this.primaryHand = undefined;
      this.lastZoomDistance = null;
      return commands;
    }

    // Determine mode
    if (processed.length >= 2 && processed.every((h) => h.pinchIndex)) {
      this.mode = "ZOOM";
      this.primaryHand = undefined;
      const distance = handDistance(processed[0], processed[1]);
      if (this.lastZoomDistance !== null) {
        const delta = this.lastZoomDistance - distance;
        const scaled = delta * this.options.zoomSensitivity;
        if (Math.abs(scaled) > this.options.zoomDeadzone) {
          commands.push({ type: "ZOOM", delta: scaled });
        }
      }
      this.lastZoomDistance = distance;
    } else {
      this.lastZoomDistance = null;
      const primary = processed[0];
      this.primaryHand = primary.handedness;
      const handState = this.ensureHandState(primary.handedness);

      if (primary.pinchIndex && primary.pinchMiddle) {
        this.mode = "PAN";
        const delta = deltaFromLast(primary.center, handState.lastCenter);
        handState.lastCenter = primary.center;
        const scaled = scaleAndDeadzone(delta, this.options.panSensitivity, this.options.moveDeadzone);
        if (scaled) {
          commands.push({ type: "PAN", dx: scaled.dx, dy: scaled.dy });
        }
      } else if (primary.pinchIndex) {
        this.mode = "ROTATE";
        const delta = deltaFromLast(primary.center, handState.lastCenter);
        handState.lastCenter = primary.center;
        const scaled = scaleAndDeadzone(delta, this.options.rotationSensitivity, this.options.moveDeadzone);
        if (scaled) {
          commands.push({ type: "ROTATE", dx: scaled.dx, dy: scaled.dy });
        }
      } else {
        this.mode = "CURSOR";
        handState.lastCenter = undefined;
      }

      // Cursor always follows primary index fingertip
      this.cursor = { ...primary.indexTip };
    }

    // Tap detection for POINTER_CLICK
    for (const hand of processed) {
      const state = this.ensureHandState(hand.handedness);
      if (hand.pinchIndex && !state.pinchIndexActive) {
        state.pinchStartTime = frame.timestamp;
      }
      if (!hand.pinchIndex && state.pinchIndexActive && state.pinchStartTime !== undefined) {
        const duration = frame.timestamp - state.pinchStartTime;
        if (duration <= this.options.tapMaxDurationMs && !hand.pinchMiddle) {
          commands.push({ type: "POINTER_CLICK", xNorm: this.cursor.x, yNorm: this.cursor.y });
        }
        state.pinchStartTime = undefined;
      }

      state.pinchIndexActive = hand.pinchIndex;
      state.pinchMiddleActive = hand.pinchMiddle;
      state.lastCenter = hand.center;
    }

    return commands;
  }

  getCursor(): { x: number; y: number } {
    return { ...this.cursor };
  }

  getDebugState(): GestureDebugState {
    return { mode: this.mode, primaryHand: this.primaryHand };
  }

  private ensureHandState(hand: Handedness): HandRuntimeState {
    if (!this.handStates.has(hand)) {
      this.handStates.set(hand, { pinchIndexActive: false, pinchMiddleActive: false });
    }
    return this.handStates.get(hand)!;
  }

  private processHand(hand: HandFrame["hands"][number]): ProcessedHand {
    const thumbTip = hand.landmarks[4];
    const indexTip = hand.landmarks[8];
    const middleTip = hand.landmarks[12];
    const pinchIndex =
      distance2D(thumbTip, indexTip) < this.options.pinchIndexThreshold;
    const pinchMiddle =
      distance2D(thumbTip, middleTip) < this.options.pinchMiddleThreshold;
    const center = averageLandmarks(hand.landmarks);
    return {
      handedness: hand.handedness,
      center,
      indexTip: { x: clamp01(indexTip.x), y: clamp01(indexTip.y) },
      pinchIndex,
      pinchMiddle,
    };
  }
}

export { DEFAULTS as defaultGestureEngineOptions };

function averageLandmarks(landmarks: Landmark[]): { x: number; y: number } {
  if (!landmarks.length) return { x: 0.5, y: 0.5 };
  const sum = landmarks.reduce(
    (acc, l) => {
      acc.x += l.x;
      acc.y += l.y;
      return acc;
    },
    { x: 0, y: 0 }
  );
  return { x: sum.x / landmarks.length, y: sum.y / landmarks.length };
}

function distance2D(a: Landmark, b: Landmark): number {
  const dx = (a?.x ?? 0) - (b?.x ?? 0);
  const dy = (a?.y ?? 0) - (b?.y ?? 0);
  return Math.hypot(dx, dy);
}

function handDistance(a: ProcessedHand, b: ProcessedHand): number {
  const dx = a.center.x - b.center.x;
  const dy = a.center.y - b.center.y;
  return Math.hypot(dx, dy);
}

function deltaFromLast(
  current: { x: number; y: number },
  last?: { x: number; y: number }
): { dx: number; dy: number } {
  if (!last) return { dx: 0, dy: 0 };
  return { dx: current.x - last.x, dy: current.y - last.y };
}

function scaleAndDeadzone(
  delta: { dx: number; dy: number },
  sensitivity: number,
  deadzone: number
): { dx: number; dy: number } | null {
  const scaled = { dx: delta.dx * sensitivity, dy: delta.dy * sensitivity };
  if (Math.abs(scaled.dx) + Math.abs(scaled.dy) < deadzone) {
    return null;
  }
  return scaled;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}
