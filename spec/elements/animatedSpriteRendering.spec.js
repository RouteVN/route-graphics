import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  textureFrom,
  dispatchLiveAnimations,
  MockAnimatedSprite,
  MockBlurFilter,
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
      this.stop = vi.fn();
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
    textureFrom: vi.fn(),
    dispatchLiveAnimations: vi.fn(() => false),
    MockAnimatedSprite: HoistedMockAnimatedSprite,
    MockBlurFilter: HoistedMockBlurFilter,
    MockSpritesheet: HoistedMockSpritesheet,
  };
});

vi.mock("pixi.js", () => ({
  AnimatedSprite: MockAnimatedSprite,
  BlurFilter: MockBlurFilter,
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
    src: "fighter-spritesheet",
    atlas: {
      frames: {
        "frame-0.png": { x: 0, y: 0, width: 32, height: 32 },
        "frame-1.png": { x: 32, y: 0, width: 32, height: 32 },
        "frame-2.png": { x: 64, y: 0, width: 32, height: 32 },
      },
      width: 96,
      height: 32,
    },
    clips: {
      idle: ["frame-0.png", "frame-1.png", "frame-2.png"],
    },
    playback: {
      clip: "idle",
      fps: 30,
      loop: true,
      autoplay: true,
    },
    alpha: 1,
    ...overrides,
  };
}

describe("spritesheet animation rendering", () => {
  beforeEach(() => {
    textureFrom.mockReset();
    textureFrom.mockReturnValue({ alias: "fighter-spritesheet" });
    dispatchLiveAnimations.mockReset();
    dispatchLiveAnimations.mockReturnValue(false);
  });

  afterEach(() => {
    window.document.body.innerHTML = "";
  });

  it("renders after asynchronously adding a spritesheet animation in debug/manual flows", async () => {
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

  it("renders after replacing spritesheet animation frame textures asynchronously", async () => {
    const app = {
      debug: false,
      render: vi.fn(),
    };
    const animatedSpriteElement = new MockAnimatedSprite([
      { frameName: "old" },
    ]);
    animatedSpriteElement.label = "animated-sprite-1";
    const parent = {
      children: [animatedSpriteElement],
    };
    const prevElement = createAnimatedSpriteElement();
    const nextElement = createAnimatedSpriteElement({
      playback: {
        frames: ["frame-2.png", "frame-1.png", "frame-0.png"],
        fps: 45,
        loop: false,
        autoplay: true,
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

  it("reloads textures when atlas or src changes even if playback does not", async () => {
    const app = {
      debug: false,
      render: vi.fn(),
    };
    const animatedSpriteElement = new MockAnimatedSprite([
      { frameName: "old" },
    ]);
    animatedSpriteElement.label = "animated-sprite-1";
    const parent = {
      children: [animatedSpriteElement],
    };
    const prevElement = createAnimatedSpriteElement();
    const nextElement = createAnimatedSpriteElement({
      src: "fighter-spritesheet-v2",
      atlas: {
        frames: {
          "frame-0.png": { x: 0, y: 0, width: 48, height: 48 },
          "frame-1.png": { x: 48, y: 0, width: 48, height: 48 },
          "frame-2.png": { x: 96, y: 0, width: 48, height: 48 },
        },
        width: 144,
        height: 48,
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

    expect(textureFrom).toHaveBeenCalledWith("fighter-spritesheet-v2");
    expect(animatedSpriteElement.textures).toEqual([
      { frameName: "frame-0.png" },
      { frameName: "frame-1.png" },
      { frameName: "frame-2.png" },
    ]);
  });

  it("re-renders when a debug snapshot frame event changes the current frame", () => {
    const animatedSprite = new MockAnimatedSprite([
      { frameName: "frame-0.png" },
    ]);
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
