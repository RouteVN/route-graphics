import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  textureFrom,
  dispatchLiveAnimations,
  MockAnimatedSprite,
  MockSpritesheet,
} = vi.hoisted(() => {
  class HoistedMockAnimatedSprite {
    constructor(textures) {
      this.textures = textures;
      this.label = "";
      this.zIndex = 0;
      this.animationSpeed = 0;
      this.loop = true;
      this.x = 0;
      this.y = 0;
      this.width = 0;
      this.height = 0;
      this.alpha = 1;
      this.destroyed = false;
      this.currentFrame = 0;
      this.gotoAndStop = vi.fn((frameIndex) => {
        this.currentFrame = frameIndex;
      });
      this.play = vi.fn();
    }
  }

  class HoistedMockSpritesheet {
    constructor(_texture, metadata) {
      this.metadata = metadata;
      this.textures = {};
    }

    async parse() {
      const frameNames = Object.keys(this.metadata.frames);
      this.textures = Object.fromEntries(
        frameNames.map((frameName) => [frameName, { frameName }]),
      );
    }
  }

  return {
    textureFrom: vi.fn(),
    dispatchLiveAnimations: vi.fn(() => false),
    MockAnimatedSprite: HoistedMockAnimatedSprite,
    MockSpritesheet: HoistedMockSpritesheet,
  };
});

vi.mock("pixi.js", () => ({
  AnimatedSprite: MockAnimatedSprite,
  Spritesheet: MockSpritesheet,
  Texture: {
    from: textureFrom,
  },
}));

vi.mock("../../src/plugins/animations/planAnimations.js", () => ({
  dispatchLiveAnimations,
}));

import { addAnimatedSprite } from "../../src/plugins/elements/animated-sprite/addAnimatedSprite.js";
import { updateAnimatedSprite } from "../../src/plugins/elements/animated-sprite/updateAnimatedSprite.js";
import {
  cleanupDebugMode,
  setupDebugMode,
} from "../../src/plugins/elements/animated-sprite/util/debugUtils.js";

function createAnimatedSpriteElement(overrides = {}) {
  return {
    id: "animated-sprite-1",
    x: 200,
    y: 150,
    width: 100,
    height: 100,
    spritesheetSrc: "fighter-spritesheet",
    spritesheetData: {
      frames: {
        "frame-0.png": {},
        "frame-1.png": {},
        "frame-2.png": {},
      },
    },
    animation: {
      frames: [0, 1, 2],
      animationSpeed: 0.5,
      loop: true,
    },
    alpha: 1,
    ...overrides,
  };
}

describe("animated sprite rendering", () => {
  beforeEach(() => {
    textureFrom.mockReset();
    textureFrom.mockReturnValue({ alias: "fighter-spritesheet" });
    dispatchLiveAnimations.mockReset();
    dispatchLiveAnimations.mockReturnValue(false);
  });

  afterEach(() => {
    window.document.body.innerHTML = "";
  });

  it("renders after asynchronously adding an animated sprite in debug/manual flows", async () => {
    const app = {
      debug: true,
      render: vi.fn(),
    };
    const parent = {
      destroyed: false,
      addChild: vi.fn(),
    };

    await addAnimatedSprite({
      app,
      parent,
      element: createAnimatedSpriteElement(),
      renderContext: {},
      zIndex: 3,
      signal: undefined,
    });

    expect(parent.addChild).toHaveBeenCalledTimes(1);
    expect(app.render).toHaveBeenCalledTimes(1);
  });

  it("renders after replacing animated sprite frame textures asynchronously", async () => {
    const app = {
      debug: false,
      render: vi.fn(),
    };
    const animatedSpriteElement = new MockAnimatedSprite([{ frameName: "old" }]);
    animatedSpriteElement.label = "animated-sprite-1";
    const parent = {
      children: [animatedSpriteElement],
    };
    const prevElement = createAnimatedSpriteElement();
    const nextElement = createAnimatedSpriteElement({
      animation: {
        frames: [2, 1, 0],
        animationSpeed: 0.75,
        loop: false,
      },
    });

    await updateAnimatedSprite({
      app,
      parent,
      prevElement,
      nextElement,
      animations: [],
      animationBus: {},
      completionTracker: {},
      zIndex: 4,
      signal: undefined,
    });

    expect(animatedSpriteElement.textures).toEqual([
      { frameName: "frame-2.png" },
      { frameName: "frame-1.png" },
      { frameName: "frame-0.png" },
    ]);
    expect(app.render).toHaveBeenCalledTimes(1);
  });

  it("re-renders when a debug snapshot frame event changes the current frame", () => {
    const animatedSprite = new MockAnimatedSprite([{ frameName: "frame-0.png" }]);
    const render = vi.fn();

    setupDebugMode(animatedSprite, "animated-sprite-1", true, render);

    window.dispatchEvent(
      new CustomEvent("snapShotAnimatedSpriteFrame", {
        detail: {
          elementId: "animated-sprite-1",
          frameIndex: 2,
        },
      }),
    );

    expect(animatedSprite.gotoAndStop).toHaveBeenCalledWith(2);
    expect(render).toHaveBeenCalledTimes(1);

    cleanupDebugMode(animatedSprite);
  });
});
