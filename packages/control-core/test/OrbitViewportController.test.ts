import { describe, expect, it } from "vitest";
import { OrbitViewportController } from "../src";

describe("OrbitViewportController (direct mode)", () => {
  it("applies rotate and clamps phi", () => {
    const controller = new OrbitViewportController({ rotationSpeed: 1 });

    controller.handle({ type: "ROTATE", dx: 1, dy: 10 });
    const state = controller.getState();

    expect(state.theta).toBeCloseTo(-1);
    expect(state.phi).toBeGreaterThan(0);
    expect(state.phi).toBeLessThan(Math.PI);
  });

  it("zooms and clamps radius", () => {
    const controller = new OrbitViewportController({ zoomSpeed: 1, minRadius: 5, maxRadius: 6, radius: 5.5 });

    controller.handle({ type: "ZOOM", delta: 10 });
    expect(controller.getState().radius).toBeCloseTo(5);

    controller.handle({ type: "ZOOM", delta: -10 });
    expect(controller.getState().radius).toBeCloseTo(6);
  });
});

describe("OrbitViewportController (inertia)", () => {
  it("integrates velocities over time", () => {
    const controller = new OrbitViewportController({
      rotationSpeed: 1,
      panSpeed: 1,
      zoomSpeed: 1,
      inertia: { enabled: true, rotationFriction: 1, panFriction: 1, zoomFriction: 1 },
    });

    controller.handle({ type: "ROTATE", dx: 1, dy: 0.5 });
    controller.handle({ type: "PAN", dx: 2, dy: -2 });
    controller.handle({ type: "ZOOM", delta: 0.1 });

    controller.update(1);
    const state = controller.getState();

    expect(state.theta).toBeCloseTo(-1);
    expect(state.phi).toBeCloseTo(Math.PI / 2 - 0.5);
    expect(state.panX).toBeCloseTo(2);
    expect(state.panY).toBeCloseTo(-2);
    expect(state.radius).toBeLessThan(40);
  });

  it("allows upside-down when clampVertical is false", () => {
    const controller = new OrbitViewportController({ rotationSpeed: 1, clampVertical: false });
    controller.handle({ type: "ROTATE", dx: 0, dy: -Math.PI * 2 });
    const state = controller.getState();
    expect(state.phi).toBeGreaterThan(Math.PI);
  });
});
