import type { TrackedHand } from "@spatial-ui-kit/gesture-core";

export interface HandModel {
  estimateHands(video: HTMLVideoElement): Promise<TrackedHand[]>;
}

export interface TFJSHandModelOptions {
  modelType?: "lite" | "full";
  maxHands?: number;
  solutionPath?: string;
  flipHorizontal?: boolean;
  runtime?: "mediapipe" | "tfjs";
}

type Runtime = "mediapipe" | "tfjs";
const detectorPromises: Record<Runtime, Promise<any> | null> = {
  mediapipe: null,
  tfjs: null,
};
let tfBackendReady: Promise<void> | null = null;

async function loadDetector(runtime: Runtime, options: TFJSHandModelOptions): Promise<any> {
  if (detectorPromises[runtime]) return detectorPromises[runtime]!;
  detectorPromises[runtime] = (async () => {
    if (runtime === "tfjs") {
      await ensureTfjsBackend();
    }
    const handPoseDetection = await import("@tensorflow-models/hand-pose-detection");
    const { SupportedModels } = handPoseDetection;
    const detector = await handPoseDetection.createDetector(SupportedModels.MediaPipeHands, {
      runtime,
      modelType: options.modelType ?? "lite",
      maxHands: options.maxHands ?? 2,
      solutionPath:
        options.solutionPath ?? "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240",
    });
    return detector;
  })();

  return detectorPromises[runtime]!;
}

class TFJSHandModel implements HandModel {
  private currentRuntime: Runtime;
  private readonly allowFallback: boolean;

  constructor(private readonly options: TFJSHandModelOptions = {}) {
    this.currentRuntime = options.runtime ?? "mediapipe";
    this.allowFallback = !options.runtime;
  }

  async estimateHands(video: HTMLVideoElement): Promise<TrackedHand[]> {
    if (!video.videoWidth || !video.videoHeight) {
      return [];
    }
    try {
      const detector = await loadDetector(this.currentRuntime, {
        modelType: this.options.modelType ?? (this.currentRuntime === "tfjs" ? "full" : "lite"),
        maxHands: this.options.maxHands,
        solutionPath: this.options.solutionPath,
        flipHorizontal: this.options.flipHorizontal,
        runtime: this.options.runtime,
      });
      const predictions = await detector.estimateHands(video, { flipHorizontal: !!this.options.flipHorizontal });
      return mapDetectionsToTrackedHands(predictions, video);
    } catch (err) {
      const name = (err as any)?.name;
      // AbortError happens when play() is interrupted; skip frame.
      if (name !== "AbortError") {
        console.error("handtracking-tfjs estimateHands failed", err);
        // Reset this runtime so next frame re-creates it; optionally fall back.
        detectorPromises[this.currentRuntime] = null;
        if (this.allowFallback && this.currentRuntime === "mediapipe") {
          this.currentRuntime = "tfjs";
        }
      }
      return [];
    }
  }
}

export function mapDetectionsToTrackedHands(
  detections: any[],
  video: { videoWidth: number; videoHeight: number }
): TrackedHand[] {
  const width = video.videoWidth || (video as any).width || 1;
  const height = video.videoHeight || (video as any).height || 1;

  return detections.map((detection) => {
    const handedness = detection.handedness?.label ?? detection.handedness ?? "Right";
    const keypoints = detection.keypoints ?? detection.keypoints3D ?? [];
    const landmarks = keypoints.map((kp: any) => {
      const isNormalized = kp.x >= 0 && kp.x <= 1 && kp.y >= 0 && kp.y <= 1;
      const x = isNormalized ? kp.x : kp.x / width;
      const y = isNormalized ? kp.y : kp.y / height;
      return { x: clamp01(x), y: clamp01(y), z: kp.z };
    });
    return { handedness, landmarks };
  });
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

async function ensureTfjsBackend() {
  if (tfBackendReady) return tfBackendReady;
  tfBackendReady = (async () => {
    const tfMod = await import("@tensorflow/tfjs-core");
    const tf: any = (tfMod as any).default ?? tfMod;
    await import("@tensorflow/tfjs-backend-webgl");
    try {
      if (tf.getBackend() !== "webgl") {
        await tf.setBackend("webgl");
      }
      await tf.ready();
    } catch {
      // Fall back to CPU if WebGL is unavailable.
      await tf.setBackend("cpu");
      await tf.ready();
    }
    // Expose for debugging in DevTools (non-breaking if already set).
    if (typeof globalThis !== "undefined" && !(globalThis as any).tf) {
      (globalThis as any).tf = tf;
    }
  })();
  return tfBackendReady;
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
