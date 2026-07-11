import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { addSprite } from "../../src/plugins/elements/sprite/addSprite.js";
import { parseSprite } from "../../src/plugins/elements/sprite/parseSprite.js";

describe("addSprite", () => {
  it("uses explicit origin independently from anchor for rotation", () => {
    const parent = new Container();
    const element = parseSprite({
      state: {
        id: "sprite-1",
        type: "sprite",
        x: 300,
        y: 200,
        width: 120,
        height: 80,
        anchorX: 0.5,
        anchorY: 0.5,
        originX: 0,
        originY: 80,
        alpha: 1,
        rotation: 45,
      },
    });

    addSprite({
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

    const spriteElement = parent.getChildByLabel("sprite-1");

    expect(element.x).toBe(240);
    expect(element.y).toBe(160);
    expect(spriteElement.pivot.x).toBe(0);
    expect(spriteElement.pivot.y * spriteElement.scale.y).toBeCloseTo(80);
    expect(spriteElement.x).toBe(240);
    expect(spriteElement.y).toBe(240);
    expect(spriteElement.rotation).toBeCloseTo(Math.PI / 4);
  });
});
