import { Container, Graphics } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { updateRect } from "../../src/plugins/elements/rect/updateRect.js";

describe("updateRect", () => {
  it("resets transient rect scale when returning to an unscaled state", () => {
    const parent = new Container();
    const rectElement = new Graphics();
    rectElement.label = "rect-1";
    rectElement.scale.set(1.5, 1.5);
    parent.addChild(rectElement);

    updateRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      prevElement: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 200,
        height: 200,
        fill: "#737373",
        alpha: 1,
        scaleX: 1.5,
        scaleY: 1.5,
      },
      nextElement: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 200,
        height: 200,
        fill: "#737373",
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
      },
      animations: [],
      animationBus: { dispatch: vi.fn() },
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      eventHandler: vi.fn(),
      zIndex: 0,
    });

    expect(rectElement.scale.x).toBe(1);
    expect(rectElement.scale.y).toBe(1);
  });
});
