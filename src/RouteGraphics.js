import { Application, Assets, Graphics, Texture, Rectangle } from "pixi.js";
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
   * @type {RouteGraphicsPlugins & { parsers: Function[] }}
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
   * @type {AbortController|undefined}
   */
  let renderAbortController;

  /**
   * @type {Function|undefined}
   */
  let debugAnimationListener;

  /**
   * Drives animation updates and presents the current frame.
   * @type {Function|undefined}
   */
  let frameTickerListener;

  /**
   * @type {(event: MouseEvent) => void | undefined}
   */
  let canvasContextMenuListener;

  /**
   * Video source URLs created or attached in loadAssets; revokable blob URLs
   * are cleaned up on destroy.
   * @type {Map<string, { url: string, revokable: boolean }>}
   */
  const videoSourceUrls = new Map();

  /**
   * Visible stage background graphic.
   * @type {Graphics|undefined}
   */
  let backgroundGraphic;

  const drawBackgroundGraphic = (graphic, width, height, color) => {
    graphic.clear();
    graphic.rect(0, 0, width, height);
    graphic.fill(color ?? 0x000000);
  };

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

  const trackVideoSourceUrl = (key, url, { revokable = false } = {}) => {
    videoSourceUrls.set(key, {
      url,
      revokable,
    });
  };

  const revokeVideoBlobUrls = () => {
    for (const value of videoSourceUrls.values()) {
      if (value?.revokable === true && typeof value?.url === "string") {
        URL.revokeObjectURL(value.url);
      }
    }
    videoSourceUrls.clear();
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

    // Present the updated stage immediately instead of relying on Pixi's
    // implicit auto-render loop, which can fail in VT/manual browser runs.
    if (typeof appInstance.render === "function") {
      appInstance.render();
    }

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
      return app.stage.getChildByLabel(targetLabel, true) ?? null;
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
      if (typeof app.ticker?.remove === "function") {
        app.ticker.remove(app.render, app);
      }
      app.debug = debug;
      canvasContextMenuListener = (event) => {
        event.preventDefault();
      };
      app.canvas.addEventListener("contextmenu", canvasContextMenuListener);

      backgroundGraphic = new Graphics();
      backgroundGraphic.label = "__route_graphics_background__";
      drawBackgroundGraphic(backgroundGraphic, width, height, backgroundColor);
      app.stage.addChild(backgroundGraphic);
      app.stage.width = width;
      app.stage.height = height;
      app.ticker.add(app.audioStage.tick);

      // Create animation bus and attach to ticker
      animationBus = createAnimationBus();
      if (!debug) {
        frameTickerListener = (time) => {
          animationBus.tick(time.deltaMS);
          if (typeof app.render === "function") {
            app.render();
          }
        };
        app.ticker.add(frameTickerListener);
      } else {
        debugAnimationListener = (event) => {
          if (event?.detail?.deltaMS) {
            animationBus.tick(Number(event.detail.deltaMS));
            if (typeof app.render === "function") {
              app.render();
            }
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
      if (frameTickerListener && typeof app?.ticker?.remove === "function") {
        app.ticker.remove(frameTickerListener);
        frameTickerListener = undefined;
      }
      if (canvasContextMenuListener && app?.canvas) {
        app.canvas.removeEventListener(
          "contextmenu",
          canvasContextMenuListener,
        );
        canvasContextMenuListener = undefined;
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
      backgroundGraphic = undefined;
      revokeVideoBlobUrls();
    },

    /**
     * Load assets from either raw buffers or direct source URLs.
     * @param {Object<string, {buffer?: ArrayBuffer, url?: string, type: string, source?: string}>} assetBufferMap - Result from assetBufferManager.getBufferMap()
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

      const texturePromises = Object.entries(assetsByType.texture).map(
        async ([key, asset]) => {
          if (Assets.cache.has(key)) {
            return Assets.cache.get(key);
          }

          if (asset?.source === "url" && typeof asset?.url === "string") {
            return Assets.load({
              alias: key,
              src: asset.url,
              parser: "loadTextures",
            });
          }

          const blob = new Blob([asset.buffer], { type: asset.type });
          const imageBitmap = await createImageBitmap(blob);
          const texture = Texture.from(imageBitmap);

          // Alias the logical asset key so Texture.from("key") resolves
          // directly from the cache instead of attempting a relative URL fetch.
          Assets.cache.set(key, texture);

          return texture;
        },
      );

      // Load video assets via direct URL when possible, otherwise fall back
      // to a revokable blob URL for buffer-backed inputs.
      const videoPromises = Object.entries(assetsByType.video).map(
        async ([key, asset]) => {
          const sourceUrl =
            asset?.source === "url" && typeof asset?.url === "string"
              ? asset.url
              : URL.createObjectURL(
                  new Blob([asset.buffer], { type: asset.type }),
                );
          const isRevokableBlobUrl = asset?.source !== "url";

          trackVideoSourceUrl(key, sourceUrl, {
            revokable: isRevokableBlobUrl,
          });

          const videoAssetDescriptor = {
            alias: key,
            src: sourceUrl,
            parser: "loadVideo",
            data: {},
          };

          if (typeof asset?.type === "string" && asset.type.length > 0) {
            videoAssetDescriptor.data.mime = asset.type;
          }

          return Assets.load(videoAssetDescriptor)
            .then((texture) => texture)
            .catch((error) => {
              videoSourceUrls.delete(key);
              if (isRevokableBlobUrl) {
                URL.revokeObjectURL(sourceUrl);
              }
              throw error;
            });
        },
      );

      return Promise.all([...texturePromises, ...videoPromises]);
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
     * @param {number} color
     */
    updatedBackgroundColor: (color) => {
      app.renderer.background.color = color;
      if (backgroundGraphic) {
        drawBackgroundGraphic(
          backgroundGraphic,
          app.renderer.width,
          app.renderer.height,
          color,
        );
      }
      if (typeof app.render === "function") {
        app.render();
      }
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
