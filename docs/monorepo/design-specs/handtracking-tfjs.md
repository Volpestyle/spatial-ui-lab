# @spatial-ui-kit/handtracking-tfjs

## Purpose

Wrap TensorFlow.js + MediaPipe Hands into a compatible HandModel that returns the TrackedHand[] type expected by gesture-core.

## Public API (v1)

```ts
import { TrackedHand } from "@spatial-ui-kit/gesture-core";

export interface HandModel {
  estimateHands(video: HTMLVideoElement): Promise<TrackedHand[]>;
}

export interface TFJSHandModelOptions {
  // For advanced usage: modelType, maxHands, solutionPath, etc.
  modelType?: "lite" | "full";
  maxHands?: number;
  solutionPath?: string; // path to mediapipe assets
}

export async function createTFJSHandModel(
  options?: TFJSHandModelOptions
): Promise<HandModel>;
```

## Behavior

- On first createTFJSHandModel call:
  - Lazily loads @tensorflow-models/hand-pose-detection.
  - Creates a MediaPipeHands detector with configuration.
  - Caches detector globally (singleton) to avoid reloading.
- estimateHands(video):
  - Calls detector.estimateHands(video, { flipHorizontal: true }).
  - Maps TF.js Hand[] → TrackedHand[]:
    - Normalizes keypoint.x / videoWidth, keypoint.y / videoHeight.
    - Copies handedness and z if available.

## Internal Structure

```
packages/handtracking-tfjs/src/
  index.ts
  modelFactory.ts  # manages singleton detector
  mapping.ts       # map TF.js output → TrackedHand
```

## Dependencies

- @tensorflow-models/hand-pose-detection
- @tensorflow/tfjs-core, @tensorflow/tfjs-converter, @tensorflow/tfjs-backend-webgl
- @mediapipe/hands
- @spatial-ui-kit/gesture-core (types only)

## Extensibility

- Later, additional implementations: createWasmHandModel(), createOnnxHandModel().
- Keep HandModel interface stable.
