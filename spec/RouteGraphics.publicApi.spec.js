import { beforeEach, describe, expect, it, vi } from "vitest";

const createPixiModuleMock = () => {
  let lastApplication = null;

  class MockDisplayObject {
    constructor(label = null) {
      this.label = label;
      this.children = [];
      this.width = 0;
      this.height = 0;
      this.x = 0;
      this.y = 0;
      this.alpha = 1;
      this.eventMode = "auto";
    }

    addChild(child) {
      this.children.push(child);
      return child;
    }

    on() {
      return this;
    }
  }

  class MockGraphics extends MockDisplayObject {
    clear() {
      this.lastFill = undefined;
      this.drawnRect = undefined;
      return this;
    }

    rect(x, y, width, height) {
      this.drawnRect = { x, y, width, height };
      return this;
    }

    fill(value) {
      this.lastFill = value;
      return this;
    }
  }

  class MockStage extends MockDisplayObject {
    getChildByLabel(targetLabel, deep = false) {
      const search = (node) => {
        if (node?.label === targetLabel) return node;
        if (!deep || !Array.isArray(node?.children)) return null;

        for (const child of node.children) {
          const found = search(child);
          if (found) return found;
        }

        return null;
      };

      for (const child of this.children) {
        const found = search(child);
        if (found) return found;
      }

      return null;
    }
  }

  class MockApplication {
    constructor() {
      lastApplication = this;
      this.stage = new MockStage();
      this.ticker = {
        add: vi.fn(),
      };
      this.renderer = {
        background: { color: 0 },
        events: {},
        width: 0,
        height: 0,
        extract: {
          base64: vi.fn(),
        },
      };
      this.canvas = document.createElement("canvas");
    }

    async init({ width, height, backgroundColor }) {
      this.renderer.width = width;
      this.renderer.height = height;
      this.renderer.background.color = backgroundColor;
    }

    destroy() {}
  }

  return {
    Application: MockApplication,
    Assets: {
      registerPlugin: vi.fn(),
      load: vi.fn(),
    },
    Graphics: MockGraphics,
    LoaderParserPriority: {
      High: 1,
    },
    extensions: {
      add: vi.fn(),
      remove: vi.fn(),
    },
    ExtensionType: {
      Asset: "asset",
    },
    Texture: class MockTexture {},
    Rectangle: class MockRectangle {},
    __getLastApplication: () => lastApplication,
  };
};

const setupRouteGraphics = async () => {
  const pixiMock = createPixiModuleMock();

  vi.doMock("pixi.js", () => pixiMock);
  vi.doMock("../src/AudioStage.js", () => ({
    createAudioStage: () => ({
      tick: vi.fn(),
      destroy: vi.fn(),
    }),
  }));
  vi.doMock("../src/AudioAsset.js", () => ({
    AudioAsset: {
      load: vi.fn(),
      getAsset: vi.fn(),
    },
  }));

  const { default: createRouteGraphics } = await import("../src/RouteGraphics.js");

  const app = createRouteGraphics();
  await app.init({
    width: 320,
    height: 240,
    backgroundColor: 0x000000,
    plugins: {
      elements: [],
      animations: [],
      audio: [],
    },
  });

  return { app, pixiMock };
};

describe("RouteGraphics public API", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns null for missing labels without throwing", async () => {
    const { app } = await setupRouteGraphics();

    expect(() => app.findElementByLabel("missing-label")).not.toThrow();
    expect(app.findElementByLabel("missing-label")).toBeNull();
  });

  it("updates the visible stage background graphic color", async () => {
    const { app, pixiMock } = await setupRouteGraphics();
    const appInstance = pixiMock.__getLastApplication();
    const backgroundGraphic = appInstance.stage.children[0];

    expect(backgroundGraphic.lastFill).toBe(0x000000);

    app.updatedBackgroundColor(0xff0000);

    expect(backgroundGraphic.lastFill).toBe(0xff0000);
    expect(appInstance.renderer.background.color).toBe(0xff0000);
  });
});
