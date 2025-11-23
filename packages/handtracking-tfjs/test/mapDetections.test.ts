import { describe, expect, it } from "vitest";
import { mapDetectionsToTrackedHands, StubHandModel } from "../src";

describe("mapDetectionsToTrackedHands", () => {
  it("normalizes keypoints to [0,1]", () => {
    const detections = [
      {
        handedness: "Left",
        keypoints: [
          { x: 100, y: 50, z: 0 },
          { x: 200, y: 100, z: 1 },
        ],
      },
    ];
    const mapped = mapDetectionsToTrackedHands(detections, { videoWidth: 200, videoHeight: 100 });
    expect(mapped[0].handedness).toBe("Left");
    expect(mapped[0].landmarks[0].x).toBeCloseTo(0.5);
    expect(mapped[0].landmarks[0].y).toBeCloseTo(0.5);
    expect(mapped[0].landmarks[1].x).toBeCloseTo(1);
  });
});

describe("StubHandModel", () => {
  it("returns empty array", async () => {
    const stub = new StubHandModel();
    const hands = await stub.estimateHands({} as HTMLVideoElement);
    expect(hands).toEqual([]);
  });
});
