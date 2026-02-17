import {
  Application,
  Assets,
  Graphics,
  LoaderParserPriority,
  extensions,
  ExtensionType,
  Texture,
  Rectangle,
} from "pixi.js";
import "@pixi/unsafe-eval";
import { createAudioStage } from "./AudioStage.js";
import parseElements from "./plugins/elements/parseElements.js";
import { AudioAsset } from "./AudioAsset.js";
import { renderElements } from "./plugins/elements/renderElements.js";
import { renderAudio } from "./plugins/audio/renderAudio.js";
import { clearPendingSounds } from "./plugins/audio/sound/addSound.js";
import { createParserPlugin } from "./plugins/elements/parserPlugin.js";
import { createKeyboardManager } from "./util/keyboardManager.js";
import { createAnimationBus } from "./plugins/animations/animationBus.js";
import { createCompletionTracker } from "./util/completionTracker.js";
import { normalizeRenderState } from "./util/normalizeRenderState.js";
import { isDeepEqual } from "./util/isDeepEqual.js";

/**
 * @typedef {import('./types.js').RouteGraphicsInitOptions} RouteGraphicsInitOptions
 * @typedef {import('./types.js').RouteGraphicsState} RouteGraphicsState
 * @typedef {import('./types.js').RouteGraphicsPlugins} RouteGraphicsPlugins
 * @typedef {import('./types.js').BaseElement} BaseElement
 */

const getPathName = (url) => {
  return url.split("/").pop();
};

const createAdvancedBufferLoader = (bufferMap) => ({
  name: "advancedBufferLoader",
  priority: 2,
  bufferMap,

  load: async (_url) => {
    // For file: URLs, use the full URL as key, otherwise use just the filename
    let url = _url.startsWith("file:") ? _url : getPathName(_url);
    const blob = bufferMap[url];

    if (!blob) {
      throw new Error(`Buffer not found for key: ${url}`);
    }

    const output = {
      data: blob.buffer,
      type: blob.type,
      metadata: null,
      alias: url,
    };

    return output;
  },

  test: async (url) => !url.startsWith("blob:"),

  testParse: async (_) => true,

  parse: async (asset) => {
    // If asset is already a Texture, return it directly
    if (asset instanceof Texture) {
      return asset;
    }

    // Convert ArrayBuffer to Blob
    const blob = new Blob([asset.data], { type: asset.type });

    // Convert Blob to ImageBitmap for images
    const imageBitmap = await createImageBitmap(blob);

    // Create and return Texture
    return Texture.from(imageBitmap);
  },

  unload: async (texture) => texture.destroy(true),
});

const VIDEO_ASSET_LOAD_CONCURRENCY = 2;

const mapWithConcurrency = async (items, concurrency, mapper) => {
  if (items.length === 0) {
    return [];
  }

  const resolvedConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: resolvedConcurrency }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

/**
 * @typedef {Object} ApplicationWithAudioStageOptions
 * @property {AudioStage} audioStage
 * @typedef {Application & ApplicationWithAudioStageOptions} ApplicationWithAudioStage
 */

const createRouteGraphics = () => {
  /**
   * @type {ApplicationWithAudioStage}
   */
  let app;

  /**
   * @type {AudioStage}
   */
  const audioStage = createAudioStage();

  /**
   * @type {RouteGraphicsState}
   */
  let state = {
    elements: [],
    animations: [],
    audio: [],
  };

  /**
   * @type {Function}
   */
  let eventHandler;

  /**
   * @type {RouteGraphicsPlugins[]}
   */
  let plugins = {
    animations: [],
    elements: [],
    audio: [],
    parsers: [],
  };

  /**
   * @type {ReturnType<typeof createKeyboardManager>}
   */
  let keyboardManager;

  /**
   * @type {ReturnType<typeof createAnimationBus>}
   */
  let animationBus;

  /**
   * @type {ReturnType<typeof createCompletionTracker>}
   */
  let completionTracker;

  /**
   * @type {Function|undefined}
   */
  let onFirstRenderCallback;

  /**
   * @type {boolean}
   */
  let hasRenderedOnce = false;

  /**
   * @type {ReturnType<ReturnType<typeof createAdvancedBufferLoader>>}
   */
  let advancedLoader;

  /**
   * @type {AbortController|undefined}
   */
  let renderAbortController;

  /**
   * @type {Function|undefined}
   */
  let debugAnimationListener;

  /**
   * Video blob URLs created in loadAssets; revoked on destroy.
   * @type {Set<string>}
   */
  const videoBlobUrls = new Set();

  /**
   * Classify asset by type
   * @param {string} mimeType - The MIME type of the asset
   * @returns {string} Asset category
   */
  const classifyAsset = (mimeType) => {
    if (!mimeType) return "texture";

    if (mimeType.startsWith("audio/")) return "audio";

    if (
      mimeType.startsWith("font/") ||
      [
        "application/font-woff",
        "application/font-woff2",
        "application/x-font-ttf",
        "application/x-font-otf",
      ].includes(mimeType)
    ) {
      return "font";
    }

    if (mimeType.startsWith("video/")) return "video";

    return "texture";
  };

  const trackVideoBlobUrl = (url) => {
    videoBlobUrls.add(url);
  };

  const revokeVideoBlobUrls = () => {
    for (const url of videoBlobUrls) {
      URL.revokeObjectURL(url);
    }
    videoBlobUrls.clear();
  };

  /**
   * Apply global cursor styles to the PixiJS application
   * @param {Application} appInstance - The PixiJS application instance
   * @param {GlobalConfiguration} [prevGlobal] - Previous global configuration
   * @param {GlobalConfiguration} [nextGlobal] - Next global configuration
   */
  const applyGlobalObjects = (appInstance, prevGlobal, nextGlobal) => {
    if (keyboardManager) {
      keyboardManager.registerHotkeys(nextGlobal?.keyboard ?? {});
    }

    // Initialize default cursor styles if they don't exist
    if (!appInstance.renderer.events.cursorStyles) {
      appInstance.renderer.events.cursorStyles = {};
    }
    if (!appInstance.renderer.events.cursorStyles.default) {
      appInstance.renderer.events.cursorStyles.default = "default";
    }
    if (!appInstance.renderer.events.cursorStyles.hover) {
      appInstance.renderer.events.cursorStyles.hover = "pointer";
    }

    const prevCursorStyles = prevGlobal?.cursorStyles;
    const nextCursorStyles = nextGlobal?.cursorStyles;

    // Only update if cursor styles have changed
    if (!isDeepEqual(prevCursorStyles, nextCursorStyles)) {
      if (nextCursorStyles) {
        // Apply new cursor styles
        if (nextCursorStyles.default) {
          appInstance.renderer.events.cursorStyles.default =
            nextCursorStyles.default;
          // Also set canvas cursor directly
          appInstance.canvas.style.cursor = nextCursorStyles.default;
        }
        if (nextCursorStyles.hover) {
          appInstance.renderer.events.cursorStyles.hover =
            nextCursorStyles.hover;
        }
      } else if (prevCursorStyles) {
        // Reset to default cursor styles if global config was removed
        appInstance.renderer.events.cursorStyles.default = "default";
        appInstance.renderer.events.cursorStyles.hover = "pointer";
      }
    }
  };

  /**
   * Render function (synchronous public API, with internal async cancellation).
   * @param {Application} appInstance
   * @param {RouteGraphicsState} nextState
   * @param {Function} handler
   */
  const renderInternal = (appInstance, parent, nextState, handler) => {
    if (renderAbortController) {
      renderAbortController.abort();
    }
    renderAbortController = new AbortController();
    const signal = renderAbortController.signal;

    // Reset completion tracker for new state (emits aborted if previous had pending)
    completionTracker.reset(nextState.id);

    applyGlobalObjects(appInstance, state.global, nextState.global);

    // Cancel all running animations synchronously
    animationBus.cancelAll();

    // Render elements (now synchronous)
    renderElements({
      app: appInstance,
      parent,
      prevComputedTree: state.elements,
      nextComputedTree: nextState.elements,
      animations: nextState.animations,
      elementPlugins: plugins.elements,
      animationBus,
      completionTracker,
      eventHandler: handler,
      signal,
    });

    // Flush animation commands to apply initial values immediately
    animationBus.flush();

    // Render audio
    renderAudio({
      app: appInstance,
      prevAudioTree: state.audio,
      nextAudioTree: nextState.audio,
      audioPlugins: plugins.audio,
    });

    state = nextState;

    // Fire stateComplete immediately if no animations/reveals to track
    completionTracker.completeIfEmpty();

    if (!hasRenderedOnce) {
      hasRenderedOnce = true;
      if (onFirstRenderCallback) {
        onFirstRenderCallback();
      }
    }
  };

  const routeGraphicsInstance = {
    rendererName: "pixi",

    get canvas() {
      return app.canvas;
    },

    findElementByLabel: (targetLabel) => {
      if (app.stage.children && app.stage.children.length > 0) {
        for (const child of app.stage.children) {
          const found = findElementByLabel(child, targetLabel);
          if (found) {
            return found;
          }
        }
      }
      return null;
    },

    extractBase64: async (label) => {
      const frame = new Rectangle(
        0,
        0,
        app.renderer.width,
        app.renderer.height,
      );
      if (!label) {
        return await app.renderer.extract.base64({ target: app.stage, frame });
      }
      const element = app.stage.getChildByLabel(label, true);
      if (!element) {
        throw new Error(`Element with label '${label}' not found`);
      }
      return await app.renderer.extract.base64({ target: element, frame });
    },

    assignStageEvent: (eventType, callback) => {
      app.stage.eventMode = "static";
      app.stage.on(eventType, callback);
    },

    resumeAudioContext: async () => {
      if (!app?.audioStage?.resume) {
        return;
      }
      await app.audioStage.resume();
    },

    /**
     *
     * @param {RouteGraphicsInitOptions} options
     * @returns
     */
    init: async (options) => {
      const {
        eventHandler: handler,
        plugins: pluginConfig,
        width,
        height,
        backgroundColor,
        debug = false,
        onFirstRender,
      } = options;

      onFirstRenderCallback = onFirstRender;

      const parserPlugins = [];

      pluginConfig?.elements?.forEach((plugin) => {
        if (plugin?.parse)
          parserPlugins.push(
            createParserPlugin({ type: plugin.type, parse: plugin.parse }),
          );
      });

      plugins = {
        animations: pluginConfig?.animations ?? [],
        elements: pluginConfig?.elements ?? [],
        audio: pluginConfig?.audio ?? [],
        parsers: parserPlugins,
      };
      eventHandler = handler;

      keyboardManager = createKeyboardManager(handler);
      completionTracker = createCompletionTracker(handler);

      /**
       * @type {ApplicationWithAudioStage}
       */
      app = new Application();
      app.audioStage = audioStage;
      await app.init({
        width,
        height,
        backgroundColor,
        preference: "webgl",
      });
      app.debug = debug;

      const graphics = new Graphics();
      graphics.rect(0, 0, width, height);
      graphics.fill(backgroundColor || 0x000000);
      app.stage.addChild(graphics);
      app.stage.width = width;
      app.stage.height = height;
      app.ticker.add(app.audioStage.tick);

      // Create animation bus and attach to ticker
      animationBus = createAnimationBus();
      if (!debug) {
        app.ticker.add((time) => animationBus.tick(time.deltaMS));
      } else {
        debugAnimationListener = (event) => {
          if (event?.detail?.deltaMS) {
            animationBus.tick(Number(event.detail.deltaMS));
          }
        };
        window.addEventListener("snapShotKeyFrame", debugAnimationListener);
      }

      return routeGraphicsInstance;
    },

    destroy: () => {
      if (renderAbortController) {
        renderAbortController.abort();
        renderAbortController = undefined;
      }
      if (debugAnimationListener) {
        window.removeEventListener("snapShotKeyFrame", debugAnimationListener);
        debugAnimationListener = undefined;
      }
      keyboardManager?.destroy();
      clearPendingSounds();
      if (animationBus) animationBus.destroy();
      if (app?.audioStage) app.audioStage.destroy();

      // Pause all video elements before destroying
      const pauseVideosRecursively = (container) => {
        for (const child of container.children) {
          const resource = child.texture?.source?.resource;
          if (resource instanceof HTMLVideoElement) {
            resource.pause();
          }
          if (child.children) {
            pauseVideosRecursively(child);
          }
        }
      };

      if (app?.stage) {
        pauseVideosRecursively(app.stage);
      }

      if (app) app.destroy();
      if (advancedLoader) {
        extensions.remove(advancedLoader);
        advancedLoader = undefined;
      }
      revokeVideoBlobUrls();
    },

    /**
     * Load assets using buffer data stored in memory
     * @param {Object<string, {buffer: ArrayBuffer, type: string}>} assetBufferMap - Result from assetBufferManager.getBufferMap()
     * @returns {Promise<Array>} Promise that resolves to an array of loaded assets
     */
    loadAssets: async (assetBufferMap) => {
      if (!assetBufferMap) {
        throw new Error("assetBufferMap is required");
      }

      // Classify assets by type
      const assetsByType = {
        audio: {},
        font: {},
        video: {},
        texture: {}, // includes images and other PIXI-compatible assets
      };

      for (const [key, asset] of Object.entries(assetBufferMap)) {
        const assetType = classifyAsset(asset.type);
        assetsByType[assetType][key] = asset;
      }

      // Load audio assets using AudioAsset.load in parallel
      await Promise.all(
        Object.entries(assetsByType.audio).map(([key, asset]) =>
          AudioAsset.load(key, asset.buffer),
        ),
      );

      // Load font assets
      await Promise.all(
        Object.entries(assetsByType.font).map(async ([key, asset]) => {
          const blob = new Blob([asset.buffer], { type: asset.type });
          const url = URL.createObjectURL(blob);
          // Use the key as font family name - this should match the fontFamily in text styles
          const fontFace = new FontFace(key, `url(${url})`);
          try {
            await fontFace.load();
            document.fonts.add(fontFace);
          } catch (error) {
            console.error(`Failed to load font ${key}:`, error);
          } finally {
            URL.revokeObjectURL(url);
          }
        }),
      );

      if (!advancedLoader) {
        advancedLoader = createAdvancedBufferLoader(assetsByType.texture);

        extensions.add({
          name: "advanced-buffer-loader",
          extension: ExtensionType.Asset,
          priority: LoaderParserPriority.High,
          loader: advancedLoader,
        });

        if (typeof Assets.registerPlugin === "function") {
          Assets.registerPlugin(advancedLoader);
        }
      } else {
        // Merge new texture assets into existing buffer map
        Object.assign(advancedLoader.bufferMap, assetsByType.texture);
      }

      const textureUrls = Object.keys(assetsByType.texture);
      const texturePromises = textureUrls.map((url) => Assets.load(url));
      const videoEntries = Object.entries(assetsByType.video);

      const [textureResults, videoResults] = await Promise.all([
        Promise.all(texturePromises),
        mapWithConcurrency(
          videoEntries,
          VIDEO_ASSET_LOAD_CONCURRENCY,
          async ([key, asset]) => {
            const blob = new Blob([asset.buffer], { type: asset.type });
            const blobUrl = URL.createObjectURL(blob);
            trackVideoBlobUrl(blobUrl);
            return Assets.load({
              alias: key,
              src: blobUrl,
              loadParser: "loadVideo",
            }).catch((error) => {
              videoBlobUrls.delete(blobUrl);
              URL.revokeObjectURL(blobUrl);
              throw error;
            });
          },
        ),
      ]);

      return [...textureResults, ...videoResults];
    },

    loadAudioAssets: async (urls) => {
      return Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          return AudioAsset.load(url, arrayBuffer);
        }),
      );
    },

    /**
     *
     * @param {string} color
     */
    updatedBackgroundColor: (color) => {
      app.renderer.background.color = color;
    },

    /**
     *
     * @param {RouteGraphicsState} stateParam
     */
    render: (stateParam) => {
      const normalizedState = normalizeRenderState(stateParam);
      const parsedElements = parseElements({
        JSONObject: normalizedState.elements,
        parserPlugins: plugins.parsers,
      });
      const parsedState = { ...normalizedState, elements: parsedElements };
      renderInternal(app, app.stage, parsedState, eventHandler);
    },

    /**
     * Parse elements from state object using registered parser plugins
     * @param {RouteGraphicsState} stateParam - The state object containing element definitions
     */
    parse: (stateParam) => {
      const normalizedState = normalizeRenderState(stateParam);
      const parsedElements = parseElements({
        JSONObject: normalizedState.elements,
        parserPlugins: plugins.parsers,
      });
      const parsedState = { ...normalizedState, elements: parsedElements };
      return parsedState;
    },
  };

  return routeGraphicsInstance;
};

export default createRouteGraphics;
