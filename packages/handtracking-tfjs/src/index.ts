import type { TrackedHand } from "@spatial-ui-kit/gesture-core";

export interface HandModel {
  estimateHands(video: HTMLVideoElement): Promise<TrackedHand[]>;
}

export interface TFJSHandModelOptions {
  modelType?: "lite" | "full";
  maxHands?: number;
  solutionPath?: string;
}

let detectorPromise: Promise<any> | null = null;

async function loadDetector(options: TFJSHandModelOptions): Promise<any> {
  if (detectorPromise) return detectorPromise;

  detectorPromise = (async () => {
    const handPoseDetection = await import("@tensorflow-models/hand-pose-detection");
    const { SupportedModels } = handPoseDetection;
    const detector = await handPoseDetection.createDetector(SupportedModels.MediaPipeHands, {
      runtime: "mediapipe",
      modelType: options.modelType ?? "lite",
      maxHands: options.maxHands ?? 2,
      solutionPath:
        options.solutionPath ?? "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240",
    });
    return detector;
  })();

  return detectorPromise;
}

class TFJSHandModel implements HandModel {
  constructor(private readonly options: TFJSHandModelOptions = {}) {}

  async estimateHands(video: HTMLVideoElement): Promise<TrackedHand[]> {
    try {
      const detector = await loadDetector(this.options);
      const predictions = await detector.estimateHands(video, { flipHorizontal: true });
      return mapDetectionsToTrackedHands(predictions, video);
    } catch (err) {
      console.error("handtracking-tfjs estimateHands failed", err);
      return [];
    }
  }
}

export function mapDetectionsToTrackedHands(
  detections: any[],
  video: { videoWidth: number; videoHeight: number }
): TrackedHand[] {
  return detections.map((detection) => {
    const handedness = detection.handedness?.label ?? detection.handedness ?? "Right";
    const keypoints = detection.keypoints3D ?? detection.keypoints ?? [];
    const landmarks = keypoints.map((kp: any) => ({
      x: clamp01(kp.x / video.videoWidth),
      y: clamp01(kp.y / video.videoHeight),
      z: kp.z,
    }));
    return { handedness, landmarks };
  });
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export async function createTFJSHandModel(options?: TFJSHandModelOptions): Promise<HandModel> {
  return new TFJSHandModel(options);
}

// Simple stub for environments without TFJS support; not exported in public API.
export class StubHandModel implements HandModel {
  async estimateHands(_video: HTMLVideoElement): Promise<TrackedHand[]> {
    return [];
  }
}
