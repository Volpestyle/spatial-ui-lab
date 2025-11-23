export type Handedness = "Left" | "Right";

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface TrackedHand {
  handedness: Handedness;
  landmarks: Landmark[];
}

export interface HandFrame {
  hands: TrackedHand[];
  timestamp: number;
}

export interface GestureEngineOptions {
  tapMaxDurationMs?: number;
  pinchIndexThreshold?: number;
  pinchMiddleThreshold?: number;
  rotationSensitivity?: number;
  panSensitivity?: number;
  zoomSensitivity?: number;
  moveDeadzone?: number;
  zoomDeadzone?: number;
}

export type GestureMode = "IDLE" | "ROTATE" | "PAN" | "ZOOM" | "CURSOR";

export interface GestureDebugState {
  mode: GestureMode;
  primaryHand?: Handedness;
}
