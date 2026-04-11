import { afterEach, describe, expect, it, vi } from "vitest";

const createMockBounds = (width, height) => ({
  x: 0,
  y: 0,
  width,
  height,
  clone() {
    return createMockBounds(this.width, this.height);
  },
});

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
      child.parent = this;
      return child;
    }

    removeChild(child) {
      this.children = this.children.filter((candidate) => candidate !== child);
      if (child) child.parent = null;
      return child;
    }

    removeFromParent() {
      this.parent?.removeChild(this);
    }

    destroy() {
      this.destroyed = true;
    }

    on() {
      return this;
    }
  }

  class MockGraphics extends MockDisplayObject {
    constructor() {
      super();
      this.scale = { x: 1, y: 1, set: vi.fn() };
      this.rotation = 0;
      this.sortableChildren = false;
    }

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

    stroke(value) {
      this.lastStroke = value;
      return this;
    }

    getLocalBounds() {
      const rectangle = createMockBounds(this.width || 1, this.height || 1);

      return {
        rectangle,
      };
    }
  }

  class MockContainer extends MockDisplayObject {
    constructor(label = null) {
      super(label);
      this.scale = { x: 1, y: 1, set: vi.fn() };
      this.rotation = 0;
      this.sortableChildren = false;
    }

    getLocalBounds() {
      const rectangle = createMockBounds(this.width || 1, this.height || 1);

      return {
        rectangle,
      };
    }
  }

  class MockSprite extends MockDisplayObject {
    constructor(texture = null) {
      super();
      this.texture = texture;
      this.scale = { x: 1, y: 1, set: vi.fn() };
      this.rotation = 0;
      this.filters = [];
    }
  }

  class MockFilter {}

  class MockUniformGroup {
    constructor(uniforms) {
      this.uniforms = Object.fromEntries(
        Object.entries(uniforms).map(([key, entry]) => [key, entry.value]),
      );
    }
  }

  class MockGlProgram {
    static from(config) {
      return config;
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
      this.render = vi.fn();
      this.renderer = {
        background: { color: 0 },
        events: {},
        width: 0,
        height: 0,
        generateTexture: vi.fn(() => ({
          destroy: vi.fn(),
          source: { resource: { width: 1, height: 1 } },
        })),
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
    Container: MockContainer,
    Sprite: MockSprite,
    Filter: MockFilter,
    GlProgram: MockGlProgram,
    UniformGroup: MockUniformGroup,
    defaultFilterVert: "void main() {}",
    Texture: class MockTexture {
      static EMPTY = {};
      static from() {
        return {
          source: { resource: { width: 1, height: 1 } },
          destroy: vi.fn(),
        };
      }
    },
    Rectangle: class MockRectangle {},
    __getLastApplication: () => lastApplication,
  };
};

let currentApp = null;

const setupRouteGraphics = async ({
  initOptions = {},
  pluginsFactory,
} = {}) => {
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

  const resolvedPlugins = pluginsFactory
    ? await pluginsFactory({ pixiMock })
    : {
        elements: [],
        animations: [],
        audio: [],
      };
  const { default: createRouteGraphics } =
    await import("../src/RouteGraphics.js");

  const app = createRouteGraphics();
  await app.init({
    width: 320,
    height: 240,
    backgroundColor: 0x000000,
    plugins: resolvedPlugins,
    ...initOptions,
  });

  currentApp = app;

  return { app, pixiMock };
};

describe("RouteGraphics public API", () => {
  afterEach(() => {
    currentApp?.destroy();
    currentApp = null;
    vi.resetModules();
  });

  it("returns null for missing labels without throwing", async () => {
    const { app } = await setupRouteGraphics();

    expect(() => app.findElementByLabel("missing-label")).not.toThrow();
    expect(app.findElementByLabel("missing-label")).toBeNull();
  }, 15000);

  it("updates the visible stage background graphic color", async () => {
    const { app, pixiMock } = await setupRouteGraphics();
    const appInstance = pixiMock.__getLastApplication();
    const backgroundGraphic = appInstance.stage.children[0];

    expect(backgroundGraphic.lastFill).toBe(0x000000);

    app.updatedBackgroundColor(0xff0000);

    expect(backgroundGraphic.lastFill).toBe(0xff0000);
    expect(appInstance.renderer.background.color).toBe(0xff0000);
  });

  it("supports manual animation playback time sampling", async () => {
    const { app } = await setupRouteGraphics({
      pluginsFactory: async () => {
        const [{ rectPlugin }, { tweenPlugin }] = await Promise.all([
          import("../src/plugins/elements/rect/index.js"),
          import("../src/plugins/animations/tween/index.js"),
        ]);

        return {
          elements: [rectPlugin],
          animations: [tweenPlugin],
          audio: [],
        };
      },
    });

    app.render({
      id: "baseline",
      elements: [
        {
          id: "preview-rect",
          type: "rect",
          x: 0,
          y: 20,
          width: 40,
          height: 40,
          fill: "#FFFFFF",
        },
      ],
    });

    app.setAnimationPlaybackMode("manual");
    app.render({
      id: "animated",
      elements: [
        {
          id: "preview-rect",
          type: "rect",
          x: 100,
          y: 20,
          width: 40,
          height: 40,
          fill: "#FFFFFF",
        },
      ],
      animations: [
        {
          id: "move-rect",
          targetId: "preview-rect",
          type: "update",
          tween: {
            x: {
              keyframes: [{ duration: 400, value: 100, easing: "linear" }],
            },
          },
        },
      ],
    });

    app.setAnimationTime(150);

    expect(app.findElementByLabel("preview-rect")?.x).toBeCloseTo(37.5);
  });

  it("applies remembered manual time to transitions that start asynchronously", async () => {
    let resolveAdd;
    const addPromise = new Promise((resolve) => {
      resolveAdd = resolve;
    });

    const { app, pixiMock } = await setupRouteGraphics({
      initOptions: {
        animationPlaybackMode: "manual",
      },
      pluginsFactory: async ({ pixiMock: activePixiMock }) => {
        const asyncTransitionPlugin = {
          type: "async-node",
          parse: ({ state }) => state,
          add: vi.fn(({ parent, element, signal }) =>
            addPromise.then(() => {
              if (signal?.aborted || parent.destroyed) {
                return;
              }

              const container = new activePixiMock.Container();
              container.label = element.id;
              parent.addChild(container);
            }),
          ),
          update: vi.fn(),
          delete: vi.fn(),
        };

        return {
          elements: [asyncTransitionPlugin],
          animations: [],
          audio: [],
        };
      },
    });

    app.render({
      id: "async-transition",
      elements: [
        {
          id: "delayed-scene",
          type: "async-node",
        },
      ],
      animations: [
        {
          id: "scene-enter",
          targetId: "delayed-scene",
          type: "transition",
          next: {
            tween: {
              alpha: {
                initialValue: 0,
                keyframes: [{ duration: 400, value: 1, easing: "linear" }],
              },
            },
          },
        },
      ],
    });

    app.setAnimationTime(200);

    resolveAdd();
    await addPromise;

    const appInstance = pixiMock.__getLastApplication();

    await vi.waitFor(() => {
      const mounted = app.findElementByLabel("delayed-scene");
      const overlay = appInstance.stage.children.at(-1);

      expect(mounted).not.toBeNull();
      expect(mounted?.visible).toBe(false);
      expect(overlay.children).toHaveLength(1);
      expect(overlay.children[0].alpha).toBeCloseTo(0.5);
    });
  });

  it("keeps same-id prev-only transitions pending until time advances", async () => {
    const eventHandler = vi.fn();
    const { app, pixiMock } = await setupRouteGraphics({
      initOptions: {
        eventHandler,
      },
      pluginsFactory: async () => {
        const [{ rectPlugin }, { tweenPlugin }] = await Promise.all([
          import("../src/plugins/elements/rect/index.js"),
          import("../src/plugins/animations/tween/index.js"),
        ]);

        return {
          elements: [rectPlugin],
          animations: [tweenPlugin],
          audio: [],
        };
      },
    });

    app.render({
      id: "baseline",
      elements: [
        {
          id: "shared-rect",
          type: "rect",
          x: 0,
          y: 0,
          width: 120,
          height: 80,
          fill: "#FFFFFF",
          alpha: 1,
        },
      ],
    });

    eventHandler.mockClear();

    app.render({
      id: "same-id-prev-only",
      elements: [
        {
          id: "shared-rect",
          type: "rect",
          x: 0,
          y: 0,
          width: 120,
          height: 80,
          fill: "#FFFFFF",
          alpha: 1,
        },
      ],
      animations: [
        {
          id: "shared-slide-out",
          targetId: "shared-rect",
          type: "transition",
          prev: {
            tween: {
              translateX: {
                initialValue: 0,
                keyframes: [{ duration: 1000, value: -1, easing: "linear" }],
              },
            },
          },
        },
      ],
    });

    expect(eventHandler).not.toHaveBeenCalledWith("renderComplete", {
      id: "same-id-prev-only",
      aborted: false,
    });

    app.setAnimationTime(200);

    const appInstance = pixiMock.__getLastApplication();
    const overlay = appInstance.stage.children.at(-1);

    expect(overlay.children).toHaveLength(1);
    expect(overlay.children[0].x).toBeLessThan(0);
    expect(eventHandler).not.toHaveBeenCalledWith("renderComplete", {
      id: "same-id-prev-only",
      aborted: false,
    });
  });

  it("does not abort pending async adds when re-rendering the same state", async () => {
    let resolveAdd;
    const addPromise = new Promise((resolve) => {
      resolveAdd = resolve;
    });

    const { app } = await setupRouteGraphics({
      pluginsFactory: async ({ pixiMock: activePixiMock }) => {
        const asyncNodePlugin = {
          type: "async-node",
          parse: ({ state }) => state,
          add: vi.fn(({ parent, element, signal }) =>
            addPromise.then(() => {
              if (signal?.aborted || parent.destroyed) {
                return;
              }

              const container = new activePixiMock.Container();
              container.label = element.id;
              parent.addChild(container);
            }),
          ),
          update: vi.fn(),
          delete: vi.fn(),
        };

        return {
          elements: [asyncNodePlugin],
          animations: [],
          audio: [],
        };
      },
    });

    const sharedState = {
      id: "async-same-state",
      elements: [
        {
          id: "delayed-node",
          type: "async-node",
        },
      ],
    };

    app.render(sharedState);
    app.render(sharedState);

    resolveAdd();
    await addPromise;

    await vi.waitFor(() => {
      expect(app.findElementByLabel("delayed-node")).not.toBeNull();
    });
  });

  it("emits renderComplete for a next-only transition in debug snapshot mode", async () => {
    const eventHandler = vi.fn();

    const { app } = await setupRouteGraphics({
      initOptions: {
        debug: true,
        eventHandler,
      },
      pluginsFactory: async () => {
        const [{ rectPlugin }, { tweenPlugin }] = await Promise.all([
          import("../src/plugins/elements/rect/index.js"),
          import("../src/plugins/animations/tween/index.js"),
        ]);

        return {
          elements: [rectPlugin],
          animations: [tweenPlugin],
          audio: [],
        };
      },
    });

    app.render({
      id: "baseline",
      elements: [
        {
          id: "baseline-rect",
          type: "rect",
          x: 80,
          y: 80,
          width: 120,
          height: 80,
          fill: "#4D4D4D",
        },
      ],
    });

    eventHandler.mockClear();

    app.render({
      id: "animation-only",
      elements: [
        {
          id: "fade-rect",
          type: "rect",
          x: 160,
          y: 100,
          width: 120,
          height: 80,
          fill: "#FFFFFF",
          alpha: 1,
        },
      ],
      animations: [
        {
          id: "fade-in",
          targetId: "fade-rect",
          type: "transition",
          next: {
            tween: {
              alpha: {
                initialValue: 0,
                keyframes: [{ duration: 600, value: 1, easing: "linear" }],
              },
            },
          },
        },
      ],
    });

    expect(eventHandler).not.toHaveBeenCalledWith("renderComplete", {
      id: "animation-only",
      aborted: false,
    });

    window.dispatchEvent(
      new CustomEvent("snapShotKeyFrame", {
        detail: { deltaMS: 700 },
      }),
    );

    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "animation-only",
      aborted: false,
    });
  });

  it("emits renderComplete once per render when an element completes synchronously", async () => {
    let routeGraphicsApp;
    const eventHandler = vi.fn((eventName, payload) => {
      if (
        eventName === "renderComplete" &&
        payload?.aborted !== true &&
        payload?.id === "sync-complete-1"
      ) {
        routeGraphicsApp.render({
          id: "sync-complete-2",
          elements: [
            {
              id: "sync-complete-line-2",
              type: "sync-complete",
            },
          ],
        });
      }
    });

    const { app } = await setupRouteGraphics({
      initOptions: {
        eventHandler,
      },
      pluginsFactory: async ({ pixiMock }) => {
        const syncCompletePlugin = {
          type: "sync-complete",
          parse: ({ state }) => state,
          add: ({ parent, element, completionTracker }) => {
            const container = new pixiMock.Container();
            container.label = element.id;
            parent.addChild(container);
            const version = completionTracker.getVersion();
            completionTracker.track(version);
            completionTracker.complete(version);
          },
          update: () => {},
          delete: () => {},
        };

        return {
          elements: [syncCompletePlugin],
          animations: [],
          audio: [],
        };
      },
    });

    routeGraphicsApp = app;

    app.render({
      id: "sync-complete-1",
      elements: [
        {
          id: "sync-complete-line-1",
          type: "sync-complete",
        },
      ],
    });

    const renderCompleteEvents = eventHandler.mock.calls.filter(
      ([eventName, payload]) =>
        eventName === "renderComplete" && payload?.aborted !== true,
    );

    expect(renderCompleteEvents).toEqual([
      ["renderComplete", { id: "sync-complete-1", aborted: false }],
      ["renderComplete", { id: "sync-complete-2", aborted: false }],
    ]);
  });
});
