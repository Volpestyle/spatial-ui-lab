import { OrbitViewportController } from "../src";

const controller = new OrbitViewportController();

controller.handle({ type: "ROTATE", dx: 5, dy: -3 });
controller.handle({ type: "ZOOM", delta: 0.2 });

console.log("Camera state after commands:", controller.getState());
