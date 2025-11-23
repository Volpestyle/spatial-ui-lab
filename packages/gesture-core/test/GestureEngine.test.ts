import { describe, expect, it } from "vitest";
import { GestureEngine } from "../src/GestureEngine";
import type { HandFrame, Landmark, TrackedHand } from "../src";

type PartialHand = {
  handedness: "Left" | "Right";
  center: [number, number];
  index?: [number, number];
  middle?: [number, number];
  thumb?: [number, number];
};

function buildHand({
  handedness,
  center,
  index = center,
  middle = center,
  thumb = center,
}: PartialHand): TrackedHand {
  const makeLandmark = (pt: [number, number]): Landmark => ({ x: pt[0], y: pt[1] });
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => makeLandmark(center));
  landmarks[4] = makeLandmark(thumb); // thumb tip
  landmarks[8] = makeLandmark(index); // index tip
  landmarks[12] = makeLandmark(middle); // middle tip
  return { handedness, landmarks };
}

function frame(hands: TrackedHand[], timestamp: number): HandFrame {
  return { hands, timestamp };
}

describe("GestureEngine", () => {
  it("emits ROTATE for single-hand pinch move", () => {
    const engine = new GestureEngine({ rotationSensitivity: 1, moveDeadzone: 0 });
    const baseHand = buildHand({
      handedness: "Right",
      center: [0.5, 0.5],
      index: [0.5, 0.5],
      thumb: [0.5, 0.5],
      middle: [0.9, 0.9], // keep middle away so only index pinch is active
    });
    engine.update(frame([baseHand], 0));

    const movedHand = buildHand({
      handedness: "Right",
      center: [0.6, 0.5],
      index: [0.6, 0.5],
      thumb: [0.6, 0.5],
      middle: [0.9, 0.9],
    });
    const commands = engine.update(frame([movedHand], 16));
    expect(commands.some((c) => c.type === "ROTATE" && c.dx > 0)).toBe(true);
  });

  it("emits PAN for double pinch move", () => {
    const engine = new GestureEngine({ panSensitivity: 1, moveDeadzone: 0 });
    const hand = buildHand({
      handedness: "Left",
      center: [0.2, 0.2],
      index: [0.2, 0.2],
      middle: [0.2, 0.2],
      thumb: [0.2, 0.2],
    });
    engine.update(frame([hand], 0));
    const moved = buildHand({
      handedness: "Left",
      center: [0.25, 0.3],
      index: [0.25, 0.3],
      middle: [0.25, 0.3],
      thumb: [0.25, 0.3],
    });
    const commands = engine.update(frame([moved], 16));
    expect(commands.some((c) => c.type === "PAN" && c.dy > 0)).toBe(true);
  });

  it("emits ZOOM when two hands pinch index", () => {
    const engine = new GestureEngine({ zoomSensitivity: 5, zoomDeadzone: 0 });
    const left = buildHand({ handedness: "Left", center: [0.2, 0.5], index: [0.2, 0.5], thumb: [0.2, 0.5] });
    const right = buildHand({ handedness: "Right", center: [0.8, 0.5], index: [0.8, 0.5], thumb: [0.8, 0.5] });
    engine.update(frame([left, right], 0));

    const closerLeft = buildHand({ handedness: "Left", center: [0.3, 0.5], index: [0.3, 0.5], thumb: [0.3, 0.5] });
    const closerRight = buildHand({ handedness: "Right", center: [0.7, 0.5], index: [0.7, 0.5], thumb: [0.7, 0.5] });
    const commands = engine.update(frame([closerLeft, closerRight], 16));
    const zoom = commands.find((c) => c.type === "ZOOM");
    expect(zoom && zoom.delta).toBeGreaterThan(0);
  });

  it("emits POINTER_CLICK on quick pinch tap", () => {
    const engine = new GestureEngine({ tapMaxDurationMs: 300, moveDeadzone: 0 });
    const openHand = buildHand({ handedness: "Right", center: [0.4, 0.4], index: [0.4, 0.4], thumb: [0.6, 0.4] });
    engine.update(frame([openHand], 0));

    const pinchStart = buildHand({ handedness: "Right", center: [0.4, 0.4], index: [0.4, 0.4], thumb: [0.4, 0.4] });
    engine.update(frame([pinchStart], 10));

    const pinchEnd = buildHand({ handedness: "Right", center: [0.4, 0.4], index: [0.4, 0.4], thumb: [0.6, 0.4] });
    const commands = engine.update(frame([pinchEnd], 50));
    const click = commands.find((c) => c.type === "POINTER_CLICK");
    expect(click).toBeTruthy();
    if (click && click.type === "POINTER_CLICK") {
      expect(click.xNorm).toBeCloseTo(0.4);
      expect(click.yNorm).toBeCloseTo(0.4);
    }
  });
});
