import { beforeEach, describe, expect, it, vi } from "vitest";

const { MockBlurFilter, textureFrom } = vi.hoisted(() => {
  class HoistedMockBlurFilter {
    constructor(options = {}) {
      this.strengthX = options.strengthX ?? options.strength ?? 0;
      this.strengthY = options.strengthY ?? options.strength ?? 0;
      this.quality = options.quality ?? 4;
      this.kernelSize = options.kernelSize ?? 5;
      this.repeatEdgePixels = false;
      this.destroy = vi.fn();
    }
  }

  return {
    MockBlurFilter: HoistedMockBlurFilter,
    textureFrom: vi.fn(),
  };
});

vi.mock("pixi.js", () => ({
  BlurFilter: MockBlurFilter,
  Texture: {
    EMPTY: { src: "" },
    from: textureFrom,
  },
}));

import { updateSprite } from "../../src/plugins/elements/sprite/updateSprite.js";

describe("updateSprite", () => {
  beforeEach(() => {
    textureFrom.mockReset();
  });

  it("swaps changed textures before dispatching update animations", () => {
    const order = [];
    const nextTexture = { src: "next-sprite" };
    textureFrom.mockImplementation((src) => {
      order.push(`texture:${src}`);
      return nextTexture;
    });

    const spriteElement = {
      label: "sprite-1",
      texture: { src: "prev-sprite" },
      x: 10,
      y: 20,
      width: 80,
      height: 80,
      alpha: 1,
      zIndex: 0,
      removeAllListeners: vi.fn(),
      on: vi.fn(),
    };
    const animationBus = {
      dispatch: vi.fn(() => {
        order.push("dispatch");
      }),
    };

    updateSprite({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent: {
        children: [spriteElement],
      },
      prevElement: {
        id: "sprite-1",
        type: "sprite",
        src: "prev-sprite",
        x: 10,
        y: 20,
        width: 80,
        height: 80,
        alpha: 1,
      },
      nextElement: {
        id: "sprite-1",
        type: "sprite",
        src: "next-sprite",
        x: 200,
        y: 120,
        width: 100,
        height: 100,
        alpha: 1,
      },
      animations: [
        {
          id: "sprite-update",
          targetId: "sprite-1",
          type: "update",
          tween: {
            x: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
          },
        },
      ],
      animationBus,
      completionTracker: {
        getVersion: vi.fn().mockReturnValue(1),
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      zIndex: 4,
    });

    expect(order).toEqual(["texture:next-sprite", "dispatch"]);
    expect(spriteElement.texture).toBe(nextTexture);
    expect(spriteElement.x).toBe(10);
    expect(spriteElement.y).toBe(20);
    expect(spriteElement.width).toBe(100);
    expect(spriteElement.height).toBe(100);
  });

  it("keeps animated dimensions at their current values before dispatch", () => {
    const order = [];
    const nextTexture = { src: "next-sprite" };
    textureFrom.mockImplementation((src) => {
      order.push(`texture:${src}`);
      return nextTexture;
    });

    const spriteElement = {
      label: "sprite-1",
      texture: { src: "prev-sprite" },
      x: 10,
      y: 20,
      width: 80,
      height: 60,
      alpha: 1,
      zIndex: 0,
      removeAllListeners: vi.fn(),
      on: vi.fn(),
    };
    const animationBus = {
      dispatch: vi.fn((command) => {
        const { element } = command.payload;
        order.push(`dispatch:${element.width}x${element.height}`);
      }),
    };

    updateSprite({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent: {
        children: [spriteElement],
      },
      prevElement: {
        id: "sprite-1",
        type: "sprite",
        src: "prev-sprite",
        x: 10,
        y: 20,
        width: 80,
        height: 60,
        alpha: 1,
      },
      nextElement: {
        id: "sprite-1",
        type: "sprite",
        src: "next-sprite",
        x: 10,
        y: 20,
        width: 120,
        height: 90,
        alpha: 1,
      },
      animations: [
        {
          id: "sprite-update",
          targetId: "sprite-1",
          type: "update",
          tween: {
            width: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
            height: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
          },
        },
      ],
      animationBus,
      completionTracker: {
        getVersion: vi.fn().mockReturnValue(1),
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      zIndex: 4,
    });

    expect(order).toEqual(["texture:next-sprite", "dispatch:80x60"]);
    expect(spriteElement.texture).toBe(nextTexture);
    expect(spriteElement.width).toBe(80);
    expect(spriteElement.height).toBe(60);
  });
});
