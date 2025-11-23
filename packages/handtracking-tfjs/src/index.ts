import type { TrackedHand } from "@spatial-ui-kit/gesture-core";

export interface HandModel {
  estimateHands(video: HTMLVideoElement): Promise<TrackedHand[]>;
}

export interface TFJSHandModelOptions {
  modelType?: "lite" | "full";
  maxHands?: number;
  solutionPath?: string;
}

class StubHandModel implements HandModel {
  // Stub implementation until TFJS wiring is added.
  async estimateHands(_video: HTMLVideoElement): Promise<TrackedHand[]> {
    return [];
  }
}

export async function createTFJSHandModel(_options?: TFJSHandModelOptions): Promise<HandModel> {
  return new StubHandModel();
}
