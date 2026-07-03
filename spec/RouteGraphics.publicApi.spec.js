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
  const assetCache = new Map();

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

    removeAllListeners() {
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
      this.scale = { x: 1, y: 1, set: vi.fn() };
      this.rotation = 0;
      this.filters = [];
      this.texture = texture;
    }

    set texture(value) {
      this._texture = value;

      if (this._width) {
        this.width = this._width;
      }

      if (this._height) {
        this.height = this._height;
      }
    }

    get texture() {
      return this._texture;
    }

    set width(value) {
      if (!this.scale) {
        this._width = value;
        return;
      }

      const textureWidth = this.texture?.orig?.width ?? 1;
      const sign = Math.sign(this.scale?.x) || 1;

      this.scale.x = textureWidth === 0 ? sign : (value / textureWidth) * sign;
      this._width = value;
    }

    get width() {
      return Math.abs(this.scale.x) * (this.texture?.orig?.width ?? 1);
    }

    set height(value) {
      if (!this.scale) {
        this._height = value;
        return;
      }

      const textureHeight = this.texture?.orig?.height ?? 1;
      const sign = Math.sign(this.scale?.y) || 1;

      this.scale.y =
        textureHeight === 0 ? sign : (value / textureHeight) * sign;
      this._height = value;
    }

    get height() {
      return Math.abs(this.scale.y) * (this.texture?.orig?.height ?? 1);
    }
  }

  class MockFilter {}

  class MockFillGradient {
    constructor(options = {}) {
      Object.assign(this, options);
    }

    destroy() {}
  }

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
      cache: {
        has: vi.fn((key) => assetCache.has(key)),
        get: vi.fn((key) => assetCache.get(key)),
        set: vi.fn((key, value) => assetCache.set(key, value)),
      },
    },
    detectVideoAlphaMode: vi.fn().mockResolvedValue("premultiplied-alpha"),
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
    FillGradient: MockFillGradient,
    GlProgram: MockGlProgram,
    UniformGroup: MockUniformGroup,
    defaultFilterVert: "void main() {}",
    Texture: class MockTexture {
      static EMPTY = {};

      constructor(options = {}) {
        this.source = options.source;
        this.orig = {
          width: this.source?.width ?? 1,
          height: this.source?.height ?? 1,
        };
        this.frame = this.orig;
        this.destroy = vi.fn();

        if (this.source) {
          this.source.__mockTextures ??= new Set();
          this.source.__mockTextures.add(this);
        }
      }

      static from(source) {
        return (
          assetCache.get(source) ??
          new MockTexture({
            source: {
              resource: { width: 1, height: 1 },
              width: 1,
              height: 1,
            },
          })
        );
      }

      once() {
        return this;
      }
    },
    VideoSource: class MockVideoSource {
      constructor(options = {}) {
        Object.assign(this, options);
        this.destroyed = false;
        this.update = vi.fn();
      }

      resize(width, height) {
        this.width = width;
        this.height = height;

        for (const texture of this.__mockTextures ?? []) {
          texture.orig.width = width;
          texture.orig.height = height;
        }
      }

      once() {
        return this;
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
  audioAsset = {
    load: vi.fn(),
    getAsset: vi.fn(),
  },
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
    AudioAsset: audioAsset,
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

  return { app, pixiMock, audioAsset };
};

const getAutoAnimationTick = (pixiMock) =>
  pixiMock.__getLastApplication().ticker.add.mock.calls.at(-1)?.[0];

const findTransitionOverlay = (pixiMock) =>
  pixiMock
    .__getLastApplication()
    .stage.children.find(
      (child) =>
        (child.label === null || child.label === undefined) &&
        Array.isArray(child.children) &&
        child.children.length > 0,
    ) ?? null;

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

  it("loads video assets through lazy HTML video textures", async () => {
    const { app, pixiMock } = await setupRouteGraphics();
    const createdVideos = [];
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:http://route-graphics/video");
    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName, ...args) => {
        const element = originalCreateElement(tagName, ...args);

        if (tagName === "video") {
          createdVideos.push(element);
          Object.defineProperty(element, "readyState", {
            value: 0,
            configurable: true,
          });
          Object.defineProperty(element, "videoWidth", {
            value: 0,
            configurable: true,
          });
          Object.defineProperty(element, "videoHeight", {
            value: 0,
            configurable: true,
          });
          element.load = vi.fn();
        }

        return element;
      });

    pixiMock.Assets.load.mockResolvedValue({ source: "loaded" });

    try {
      await app.loadAssets({
        urlTexture: {
          source: "url",
          url: "blob:http://route-graphics/texture",
          type: "image/png",
        },
        bufferVideo: {
          buffer: new Uint8Array([1, 2, 3]).buffer,
          type: "video/mp4",
        },
        urlVideo: {
          source: "url",
          url: "http://project-file.localhost/pixi-asset.mp4?path=video",
          type: "video/mp4",
        },
      });
    } finally {
      createElement.mockRestore();
      createObjectURL.mockRestore();
    }

    expect(pixiMock.Assets.load).toHaveBeenCalledTimes(1);
    expect(pixiMock.Assets.load).toHaveBeenCalledWith({
      alias: "urlTexture",
      src: "blob:http://route-graphics/texture",
    });
    expect(pixiMock.Assets.cache.set).toHaveBeenCalledWith(
      "bufferVideo",
      expect.objectContaining({
        source: expect.any(Object),
      }),
    );
    expect(pixiMock.Assets.cache.set).toHaveBeenCalledWith(
      "urlVideo",
      expect.objectContaining({
        source: expect.any(Object),
      }),
    );
    const bufferVideoTexture = pixiMock.Assets.cache.set.mock.calls.find(
      ([key]) => key === "bufferVideo",
    )?.[1];
    expect(bufferVideoTexture.source.width).toBe(1);
    expect(bufferVideoTexture.source.height).toBe(1);
    expect(bufferVideoTexture.source.alphaMode).toBe("premultiplied-alpha");
    expect(bufferVideoTexture.source.update).not.toHaveBeenCalled();
    expect(pixiMock.detectVideoAlphaMode).toHaveBeenCalled();
    expect(createdVideos).toHaveLength(2);
    expect(
      createdVideos.every((video) => video.crossOrigin === "anonymous"),
    ).toBe(true);
    expect(createdVideos.every((video) => video.preload === "metadata")).toBe(
      true,
    );
    expect(
      createdVideos.every((video) => video.load.mock.calls.length === 1),
    ).toBe(true);
    expect(
      createdVideos.every((video) => {
        const sourceElement = video.querySelector("source");

        return (
          sourceElement?.src &&
          sourceElement.type === "video/mp4" &&
          video.getAttribute("webkit-playsinline") === ""
        );
      }),
    ).toBe(true);
  });

  it("awaits audio asset decoding during loadAssets", async () => {
    let resolveAudioLoad;
    const audioLoadPromise = new Promise((resolve) => {
      resolveAudioLoad = resolve;
    });
    const audioAsset = {
      load: vi.fn(() => audioLoadPromise),
      getAsset: vi.fn(),
    };
    const { app } = await setupRouteGraphics({ audioAsset });
    let loadAssetsResolved = false;

    const loadAssetsPromise = app
      .loadAssets({
        click: {
          buffer: new Uint8Array([1, 2, 3]).buffer,
          type: "audio/mpeg",
        },
      })
      .then(() => {
        loadAssetsResolved = true;
      });

    await Promise.resolve();

    expect(audioAsset.load).toHaveBeenCalledWith(
      "click",
      expect.any(ArrayBuffer),
    );
    expect(loadAssetsResolved).toBe(false);

    resolveAudioLoad();
    await loadAssetsPromise;

    expect(loadAssetsResolved).toBe(true);
  });

  it("adds asset key, type, phase, and cause to Pixi texture load failures", async () => {
    const { app, pixiMock } = await setupRouteGraphics();
    pixiMock.Assets.load.mockRejectedValue(new Error("Pixi could not load"));

    let thrownError;
    try {
      await app.loadAssets({
        cityBackground: {
          source: "url",
          url: "https://cdn.example.test/city.png",
          type: "image/png",
        },
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError?.message).toBe(
      'Could not load image "cityBackground". Missing, inaccessible, or unsupported image file.',
    );
    expect(thrownError?.details).toEqual(
      expect.objectContaining({
        assetKey: "cityBackground",
        assetKind: "image",
        assetCategory: "texture",
        phase: "Pixi URL load",
        type: "image/png",
        source: "url",
        url: "https://cdn.example.test/city.png",
        cause: "Pixi could not load",
      }),
    );
  });

  it("aggregates multiple asset load failures with their root causes", async () => {
    const audioAsset = {
      load: vi.fn(() => Promise.reject(new Error("audio decode failed"))),
      getAsset: vi.fn(),
    };
    const { app, pixiMock } = await setupRouteGraphics({ audioAsset });
    pixiMock.Assets.load.mockRejectedValue(new Error("texture fetch failed"));

    let thrownError;
    try {
      await app.loadAssets({
        click: {
          buffer: new Uint8Array([1, 2, 3]).buffer,
          type: "audio/mpeg",
        },
        background: {
          source: "url",
          url: "https://cdn.example.test/background.png",
          type: "image/png",
        },
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError?.message).toBe(
      'Could not load 2 assets: audio "click", image "background". audio "click": Unsupported or damaged audio file.; image "background": Missing, inaccessible, or unsupported image file.',
    );
    expect(thrownError?.details?.failures).toEqual([
      expect.objectContaining({
        assetKey: "click",
        assetKind: "audio",
        cause: "audio decode failed",
      }),
      expect.objectContaining({
        assetKey: "background",
        assetKind: "image",
        cause: "texture fetch failed",
      }),
    ]);
  });

  it("does not reject video asset preload when browser defers media readiness", async () => {
    const { app, pixiMock } = await setupRouteGraphics();
    const createdVideos = [];
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:http://route-graphics/video");
    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName, ...args) => {
        const element = originalCreateElement(tagName, ...args);

        if (tagName === "video") {
          createdVideos.push(element);
          Object.defineProperty(element, "readyState", {
            value: 0,
            configurable: true,
          });
          Object.defineProperty(element, "networkState", {
            value: 3,
            configurable: true,
          });
          Object.defineProperty(element, "error", {
            value: {
              code: 4,
              message: "No supported source was found",
            },
            configurable: true,
          });
          Object.defineProperty(element, "currentSrc", {
            value: "blob:http://route-graphics/video",
            configurable: true,
          });
          element.load = vi.fn(() => {
            queueMicrotask(() => {
              element.dispatchEvent(new Event("error"));
            });
          });
        }

        return element;
      });

    try {
      await app.loadAssets({
        introVideo: {
          buffer: new Uint8Array([1, 2, 3]).buffer,
          type: "video/mp4",
        },
        outroVideo: {
          buffer: new Uint8Array([4, 5, 6]).buffer,
          type: "video/mp4",
        },
      });
    } finally {
      createElement.mockRestore();
      createObjectURL.mockRestore();
    }

    expect(createdVideos).toHaveLength(2);
    expect(pixiMock.Assets.cache.set).toHaveBeenCalledWith(
      "introVideo",
      expect.objectContaining({
        source: expect.any(Object),
      }),
    );
    expect(pixiMock.Assets.cache.set).toHaveBeenCalledWith(
      "outroVideo",
      expect.objectContaining({
        source: expect.any(Object),
      }),
    );
  });

  it("updates lazy video texture when first mounted after frame data is ready", async () => {
    const { app, pixiMock } = await setupRouteGraphics({
      pluginsFactory: async () => {
        const { videoPlugin } =
          await import("../src/plugins/elements/video/index.js");

        return {
          elements: [videoPlugin],
          animations: [],
          audio: [],
        };
      },
    });
    const createdVideos = [];
    const originalHTMLVideoElement = globalThis.HTMLVideoElement;
    Object.defineProperty(globalThis, "HTMLVideoElement", {
      value: window.HTMLVideoElement,
      configurable: true,
    });
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:http://route-graphics/video");
    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName, ...args) => {
        const element = originalCreateElement(tagName, ...args);

        if (tagName === "video") {
          createdVideos.push(element);
          Object.defineProperty(element, "readyState", {
            value: 0,
            configurable: true,
          });
          Object.defineProperty(element, "videoWidth", {
            value: 0,
            configurable: true,
          });
          Object.defineProperty(element, "videoHeight", {
            value: 0,
            configurable: true,
          });
          element.load = vi.fn();
          element.pause = vi.fn();
          element.play = vi.fn();
        }

        return element;
      });

    try {
      await app.loadAssets({
        introVideo: {
          buffer: new Uint8Array([1, 2, 3]).buffer,
          type: "video/mp4",
        },
      });

      const texture = pixiMock.Assets.cache.get("introVideo");
      expect(texture.source.update).not.toHaveBeenCalled();

      Object.defineProperty(createdVideos[0], "readyState", {
        value: window.HTMLMediaElement.HAVE_CURRENT_DATA,
        configurable: true,
      });
      Object.defineProperty(createdVideos[0], "videoWidth", {
        value: 640,
        configurable: true,
      });
      Object.defineProperty(createdVideos[0], "videoHeight", {
        value: 360,
        configurable: true,
      });

      app.render({
        id: "video-state",
        elements: [
          {
            id: "intro",
            type: "video",
            x: 0,
            y: 0,
            width: 320,
            height: 180,
            src: "introVideo",
          },
        ],
      });

      const sprite = app.findElementByLabel("intro");

      expect(texture.source.width).toBe(640);
      expect(texture.source.height).toBe(360);
      expect(texture.source.update).toHaveBeenCalled();
      expect(sprite.width).toBe(320);
      expect(sprite.height).toBe(180);
    } finally {
      Object.defineProperty(globalThis, "HTMLVideoElement", {
        value: originalHTMLVideoElement,
        configurable: true,
      });
      createElement.mockRestore();
      createObjectURL.mockRestore();
    }
  });

  it("preserves video sprite dimensions when lazy frame data resizes the texture", async () => {
    const { app, pixiMock } = await setupRouteGraphics({
      pluginsFactory: async () => {
        const { videoPlugin } =
          await import("../src/plugins/elements/video/index.js");

        return {
          elements: [videoPlugin],
          animations: [],
          audio: [],
        };
      },
    });
    const createdVideos = [];
    const originalHTMLVideoElement = globalThis.HTMLVideoElement;
    Object.defineProperty(globalThis, "HTMLVideoElement", {
      value: window.HTMLVideoElement,
      configurable: true,
    });
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:http://route-graphics/video");
    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName, ...args) => {
        const element = originalCreateElement(tagName, ...args);

        if (tagName === "video") {
          createdVideos.push(element);
          Object.defineProperty(element, "readyState", {
            value: 0,
            configurable: true,
          });
          Object.defineProperty(element, "videoWidth", {
            value: 0,
            configurable: true,
          });
          Object.defineProperty(element, "videoHeight", {
            value: 0,
            configurable: true,
          });
          element.load = vi.fn();
          element.pause = vi.fn();
          element.play = vi.fn();
        }

        return element;
      });

    try {
      await app.loadAssets({
        introVideo: {
          buffer: new Uint8Array([1, 2, 3]).buffer,
          type: "video/mp4",
        },
      });

      app.render({
        id: "video-state",
        elements: [
          {
            id: "intro",
            type: "video",
            x: 0,
            y: 0,
            width: 320,
            height: 180,
            src: "introVideo",
          },
        ],
      });

      const sprite = app.findElementByLabel("intro");
      const texture = pixiMock.Assets.cache.get("introVideo");

      expect(sprite.width).toBe(320);
      expect(sprite.height).toBe(180);
      expect(texture.source.width).toBe(1);
      expect(texture.source.height).toBe(1);

      Object.defineProperty(createdVideos[0], "readyState", {
        value: window.HTMLMediaElement.HAVE_CURRENT_DATA,
        configurable: true,
      });
      Object.defineProperty(createdVideos[0], "videoWidth", {
        value: 1920,
        configurable: true,
      });
      Object.defineProperty(createdVideos[0], "videoHeight", {
        value: 1080,
        configurable: true,
      });

      createdVideos[0].dispatchEvent(new window.Event("loadeddata"));

      expect(texture.source.width).toBe(1920);
      expect(texture.source.height).toBe(1080);
      expect(texture.orig.width).toBe(1920);
      expect(texture.orig.height).toBe(1080);
      expect(sprite.width).toBe(320);
      expect(sprite.height).toBe(180);
      expect(sprite.scale.x).toBeCloseTo(320 / 1920);
      expect(sprite.scale.y).toBeCloseTo(180 / 1080);
    } finally {
      Object.defineProperty(globalThis, "HTMLVideoElement", {
        value: originalHTMLVideoElement,
        configurable: true,
      });
      createElement.mockRestore();
      createObjectURL.mockRestore();
    }
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

  it("continues persistent update animations across unrelated renders without restarting", async () => {
    const { app, pixiMock } = await setupRouteGraphics({
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

    const frameTick = getAutoAnimationTick(pixiMock);

    app.render({
      id: "baseline",
      elements: [
        {
          id: "bg",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
        {
          id: "front",
          type: "rect",
          x: 120,
          y: 0,
          width: 40,
          height: 40,
          fill: "#999999",
        },
      ],
    });

    app.render({
      id: "persistent-update-1",
      elements: [
        {
          id: "bg",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
        {
          id: "front",
          type: "rect",
          x: 120,
          y: 0,
          width: 40,
          height: 40,
          fill: "#999999",
        },
      ],
      animations: [
        {
          id: "bg-breathe",
          targetId: "bg",
          type: "update",
          playback: {
            continuity: "persistent",
          },
          tween: {
            scaleX: {
              initialValue: 1,
              keyframes: [{ duration: 1000, value: 2, easing: "linear" }],
            },
            scaleY: {
              initialValue: 1,
              keyframes: [{ duration: 1000, value: 2, easing: "linear" }],
            },
          },
        },
      ],
    });

    frameTick({ deltaMS: 400 });
    expect(app.findElementByLabel("bg")?.scale.x).toBeCloseTo(1.4);
    expect(app.findElementByLabel("bg")?.scale.y).toBeCloseTo(1.4);

    app.render({
      id: "persistent-update-2",
      elements: [
        {
          id: "bg",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
        {
          id: "front",
          type: "rect",
          x: 180,
          y: 0,
          width: 40,
          height: 40,
          fill: "#999999",
        },
      ],
      animations: [
        {
          id: "bg-breathe",
          targetId: "bg",
          type: "update",
          playback: {
            continuity: "persistent",
          },
          tween: {
            scaleX: {
              initialValue: 1,
              keyframes: [{ duration: 1000, value: 2, easing: "linear" }],
            },
            scaleY: {
              initialValue: 1,
              keyframes: [{ duration: 1000, value: 2, easing: "linear" }],
            },
          },
        },
      ],
    });

    expect(app.findElementByLabel("bg")?.scale.x).toBeCloseTo(1.4);
    expect(app.findElementByLabel("bg")?.scale.y).toBeCloseTo(1.4);

    frameTick({ deltaMS: 100 });
    expect(app.findElementByLabel("bg")?.scale.x).toBeCloseTo(1.5);
    expect(app.findElementByLabel("bg")?.scale.y).toBeCloseTo(1.5);
  });

  it("emits renderComplete immediately for persistent update playback", async () => {
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

    const frameTick = getAutoAnimationTick(pixiMock);

    app.render({
      id: "baseline",
      elements: [
        {
          id: "bg",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
      ],
    });

    eventHandler.mockClear();

    app.render({
      id: "persistent-update-finish",
      elements: [
        {
          id: "bg",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
      ],
      animations: [
        {
          id: "bg-breathe",
          targetId: "bg",
          type: "update",
          playback: {
            continuity: "persistent",
          },
          tween: {
            alpha: {
              initialValue: 0,
              keyframes: [{ duration: 300, value: 1, easing: "linear" }],
            },
          },
        },
      ],
    });

    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "persistent-update-finish",
      aborted: false,
    });

    const eventCountAfterRender = eventHandler.mock.calls.length;
    frameTick({ deltaMS: 300 });

    expect(eventHandler.mock.calls).toHaveLength(eventCountAfterRender);
  });

  it("does not abort or re-complete persistent updates after a later render adopts them", async () => {
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

    const frameTick = getAutoAnimationTick(pixiMock);

    app.render({
      id: "baseline",
      elements: [
        {
          id: "bg",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
        {
          id: "front",
          type: "rect",
          x: 120,
          y: 0,
          width: 40,
          height: 40,
          fill: "#999999",
        },
      ],
    });

    eventHandler.mockClear();

    app.render({
      id: "persistent-update-old",
      elements: [
        {
          id: "bg",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
        {
          id: "front",
          type: "rect",
          x: 120,
          y: 0,
          width: 40,
          height: 40,
          fill: "#999999",
        },
      ],
      animations: [
        {
          id: "bg-breathe",
          targetId: "bg",
          type: "update",
          playback: {
            continuity: "persistent",
          },
          tween: {
            alpha: {
              initialValue: 0,
              keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
            },
          },
        },
      ],
    });

    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "persistent-update-old",
      aborted: false,
    });

    frameTick({ deltaMS: 400 });
    eventHandler.mockClear();

    app.render({
      id: "persistent-update-new",
      elements: [
        {
          id: "bg",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
        {
          id: "front",
          type: "rect",
          x: 180,
          y: 0,
          width: 40,
          height: 40,
          fill: "#999999",
        },
      ],
      animations: [
        {
          id: "bg-breathe",
          targetId: "bg",
          type: "update",
          playback: {
            continuity: "persistent",
          },
          tween: {
            alpha: {
              initialValue: 0,
              keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
            },
          },
        },
      ],
    });

    expect(eventHandler).not.toHaveBeenCalledWith("renderComplete", {
      id: "persistent-update-old",
      aborted: true,
    });
    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "persistent-update-new",
      aborted: false,
    });

    const eventCountAfterAdoption = eventHandler.mock.calls.length;
    frameTick({ deltaMS: 600 });

    expect(eventHandler.mock.calls).toHaveLength(eventCountAfterAdoption);
    expect(eventHandler).not.toHaveBeenCalledWith("renderComplete", {
      id: "persistent-update-old",
      aborted: false,
    });
  });

  it("continues persistent transition overlays across unrelated renders without restarting", async () => {
    const { app, pixiMock } = await setupRouteGraphics({
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

    const frameTick = getAutoAnimationTick(pixiMock);

    app.render({
      id: "baseline",
      elements: [
        {
          id: "front",
          type: "rect",
          x: 120,
          y: 0,
          width: 40,
          height: 40,
          fill: "#999999",
        },
      ],
    });

    app.render({
      id: "persistent-transition-1",
      elements: [
        {
          id: "scene",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
        {
          id: "front",
          type: "rect",
          x: 120,
          y: 0,
          width: 40,
          height: 40,
          fill: "#999999",
        },
      ],
      animations: [
        {
          id: "scene-fade",
          targetId: "scene",
          type: "transition",
          playback: {
            continuity: "persistent",
          },
          next: {
            tween: {
              alpha: {
                initialValue: 0,
                keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
              },
            },
          },
        },
      ],
    });

    frameTick({ deltaMS: 400 });
    let overlay = findTransitionOverlay(pixiMock);
    expect(overlay?.children).toHaveLength(1);
    expect(overlay?.children[0].alpha).toBeCloseTo(0.4);

    app.render({
      id: "persistent-transition-2",
      elements: [
        {
          id: "scene",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
        {
          id: "front",
          type: "rect",
          x: 180,
          y: 0,
          width: 40,
          height: 40,
          fill: "#999999",
        },
      ],
      animations: [
        {
          id: "scene-fade",
          targetId: "scene",
          type: "transition",
          playback: {
            continuity: "persistent",
          },
          next: {
            tween: {
              alpha: {
                initialValue: 0,
                keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
              },
            },
          },
        },
      ],
    });

    overlay = findTransitionOverlay(pixiMock);
    expect(overlay?.children[0].alpha).toBeCloseTo(0.4);

    frameTick({ deltaMS: 100 });
    overlay = findTransitionOverlay(pixiMock);
    expect(overlay?.children[0].alpha).toBeCloseTo(0.5);
  });

  it("does not abort or re-complete persistent transitions after a later render adopts them", async () => {
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

    const frameTick = getAutoAnimationTick(pixiMock);

    app.render({
      id: "baseline",
      elements: [],
    });

    eventHandler.mockClear();

    app.render({
      id: "persistent-transition-old",
      elements: [
        {
          id: "scene",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
      ],
      animations: [
        {
          id: "scene-fade",
          targetId: "scene",
          type: "transition",
          playback: {
            continuity: "persistent",
          },
          next: {
            tween: {
              alpha: {
                initialValue: 0,
                keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
              },
            },
          },
        },
      ],
    });

    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "persistent-transition-old",
      aborted: false,
    });

    frameTick({ deltaMS: 400 });
    eventHandler.mockClear();

    app.render({
      id: "persistent-transition-new",
      elements: [
        {
          id: "scene",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fill: "#FFFFFF",
        },
      ],
      animations: [
        {
          id: "scene-fade",
          targetId: "scene",
          type: "transition",
          playback: {
            continuity: "persistent",
          },
          next: {
            tween: {
              alpha: {
                initialValue: 0,
                keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
              },
            },
          },
        },
      ],
    });

    expect(eventHandler).not.toHaveBeenCalledWith("renderComplete", {
      id: "persistent-transition-old",
      aborted: true,
    });
    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "persistent-transition-new",
      aborted: false,
    });

    const eventCountAfterAdoption = eventHandler.mock.calls.length;
    frameTick({ deltaMS: 600 });

    expect(eventHandler.mock.calls).toHaveLength(eventCountAfterAdoption);
    expect(eventHandler).not.toHaveBeenCalledWith("renderComplete", {
      id: "persistent-transition-old",
      aborted: false,
    });
  });

  it("preserves pending persistent transitions across later renders before async mount resolves", async () => {
    let resolveAdd;
    const addPromise = new Promise((resolve) => {
      resolveAdd = resolve;
    });

    const { app, pixiMock } = await setupRouteGraphics({
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

    const frameTick = getAutoAnimationTick(pixiMock);

    app.render({
      id: "persistent-async-old",
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
          playback: {
            continuity: "persistent",
          },
          next: {
            tween: {
              alpha: {
                initialValue: 0,
                keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
              },
            },
          },
        },
      ],
    });

    app.render({
      id: "persistent-async-new",
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
          playback: {
            continuity: "persistent",
          },
          next: {
            tween: {
              alpha: {
                initialValue: 0,
                keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
              },
            },
          },
        },
      ],
    });

    resolveAdd();
    await addPromise;

    await vi.waitFor(() => {
      const mounted = app.findElementByLabel("delayed-scene");
      const overlay = findTransitionOverlay(pixiMock);

      expect(mounted).not.toBeNull();
      expect(mounted?.visible).toBe(false);
      expect(overlay).not.toBeNull();
    });

    frameTick({ deltaMS: 200 });

    const overlay = findTransitionOverlay(pixiMock);
    expect(overlay?.children[0].alpha).toBeCloseTo(0.2);
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
