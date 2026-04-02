import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { addRect } from "../../src/plugins/elements/rect/addRect.js";
import { parseRect } from "../../src/plugins/elements/rect/parseRect.js";

describe("addRect", () => {
  it("renders scaled rect geometry without double-applying the live scale", () => {
    const parent = new Container();
    const element = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 220,
        height: 180,
        fill: "#737373",
        alpha: 1,
        scaleX: 1.5,
        scaleY: 0.6,
      },
    });

    addRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      element,
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

    const rectElement = parent.getChildByLabel("rect-1");

    expect(rectElement.scale.x).toBe(1);
    expect(rectElement.scale.y).toBe(1);
    expect(rectElement.width).toBe(element.width);
    expect(rectElement.height).toBe(element.height);
  });
});
