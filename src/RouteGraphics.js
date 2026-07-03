import {
  Application,
  Assets,
  Graphics,
  Texture,
  Rectangle,
  VideoSource,
  detectVideoAlphaMode,
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
import { createInputDomBridge } from "./util/inputDomBridge.js";
import { buildAnimationContinuityPlan } from "./plugins/animations/planAnimations.js";
import { cleanupParticlesInTree } from "./plugins/elements/particles/particleRuntime.js";

/**
 * @typedef {import('./types.js').RouteGraphicsInitOptions} RouteGraphicsInitOptions
 * @typedef {import('./types.js').RouteGraphicsState} RouteGraphicsState
 * @typedef {import('./types.js').RouteGraphicsPlugins} RouteGraphicsPlugins
 * @typedef {import('./types.js').BaseElement} BaseElement
 */

/**
 * @typedef {Object} ApplicationWithAudioStageOptions
 * @property {AudioStage} audioStage
 * @property {ReturnType<typeof createInputDomBridge>} [inputDomBridge]
 * @typedef {Application & ApplicationWithAudioStageOptions} ApplicationWithAudioStage
 */

const createRouteGraphics = () => {
  const VIDEO_TEXTURE_UPDATE_FPS = 30;

  const createVideoTextureSource = (video, alphaMode) =>
    new VideoSource({
      resource: video,
      width: video.videoWidth || undefined,
      height: video.videoHeight || undefined,
      autoLoad: false,
      autoPlay: false,
      alphaMode,
      crossorigin: "anonymous",
      muted: false,
      playsinline: true,
    });

  const configureManagedVideoTextureUpdates = (texture) => {
    const source = texture?.source;
    const video = source?.resource;

    if (!(video instanceof HTMLVideoElement)) {
      return;
    }

    if (source.__routeGraphicsVideoTextureRuntime) {
      return;
    }

    let frameId;
    let lastUpdateTime = 0;
    const frameIntervalMS = 1000 / VIDEO_TEXTURE_UPDATE_FPS;

    const updateSource = () => {
      if (!source.destroyed) {
        source.update();
      }
    };

    const stop = () => {
      if (frameId !== undefined) {
        window.cancelAnimationFrame(frameId);
        frameId = undefined;
      }
      updateSource();
    };

    const tick = (time) => {
      frameId = undefined;
      if (video.paused || video.ended || source.destroyed) {
        return;
      }

      if (time - lastUpdateTime >= frameIntervalMS) {
        lastUpdateTime = time;
        updateSource();
      }

      frameId = window.requestAnimationFrame(tick);
    };

    const start = () => {
      updateSource();

      if (frameId === undefined) {
        lastUpdateTime = 0;
        frameId = window.requestAnimationFrame(tick);
      }
    };

    const cleanup = () => {
      stop();
      video.removeEventListener("play", start);
      video.removeEventListener("playing", start);
      video.removeEventListener("pause", stop);
      video.removeEventListener("ended", stop);
      video.removeEventListener("seeked", updateSource);
      source.__routeGraphicsVideoTextureRuntime = undefined;
    };

    video.addEventListener("play", start);
    video.addEventListener("playing", start);
    video.addEventListener("pause", stop);
    video.addEventListener("ended", stop);
    video.addEventListener("seeked", updateSource);
    source.once("destroy", cleanup);
    texture.once("destroy", cleanup);

    source.__routeGraphicsVideoTextureRuntime = {
      cleanup,
    };
    updateSource();
  };

  const assertAnimationPlaybackMode = (mode) => {
    if (mode !== "auto" && mode !== "manual") {
      throw new Error(
        `Invalid animation playback mode "${mode}". Expected "auto" or "manual".`,
      );
    }
  };

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
    audioEffects: [],
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
   * @type {"auto" | "manual"}
   */
  let animationPlaybackMode = "auto";

  /**
   * @type {number | null}
   */
  let animationPlaybackTimeMS = null;

  /**
   * @type {Function[]}
   */
  let animationBusListenerCleanup = [];

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

  const getErrorMessage = (error) => {
    if (!error) return "Unknown error";
    if (typeof error === "string") return error;
    return error.message || String(error);
  };

  const truncateErrorValue = (value, maxLength = 180) => {
    if (typeof value !== "string") return undefined;
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1)}...`;
  };

  const getBufferByteLength = (buffer) => {
    if (!buffer) return 0;
    if (typeof buffer.byteLength === "number") return buffer.byteLength;
    return 0;
  };

  const getAssetKindLabel = (category, asset = {}) => {
    if (category === "texture") {
      return asset.type?.startsWith("image/") ? "image" : "visual asset";
    }

    return category || "asset";
  };

  const getHttpStatusCode = (message) => {
    const match = message.match(/HTTP\s+(\d{3})/);
    return match?.[1];
  };

  const getFriendlyCauseMessage = ({ category, phase, error }) => {
    if (error?.rootCauseMessage) {
      return error.rootCauseMessage;
    }

    const causeMessage = getErrorMessage(error);
    const httpStatusCode = getHttpStatusCode(causeMessage);

    if (httpStatusCode === "404") {
      return "File not found.";
    }

    if (httpStatusCode === "401" || httpStatusCode === "403") {
      return "Access denied.";
    }

    if (httpStatusCode?.startsWith("5")) {
      return "File server error.";
    }

    if (/URL is missing/i.test(causeMessage)) {
      return "Missing file URL.";
    }

    if (/missing or empty/i.test(causeMessage)) {
      return "Missing file data.";
    }

    if (category === "audio" || /decode/i.test(causeMessage)) {
      return "Unsupported or damaged audio file.";
    }

    if (category === "font") {
      return "Unsupported or damaged font file.";
    }

    if (category === "video") {
      return "Unsupported, damaged, or inaccessible video file.";
    }

    if (category === "texture" && phase === "image bitmap creation") {
      return "Unsupported or damaged image file.";
    }

    if (category === "texture") {
      return "Missing, inaccessible, or unsupported image file.";
    }

    return "File could not be loaded.";
  };

  const getAssetErrorDetails = ({
    key,
    kind,
    category,
    phase,
    asset,
    error,
  }) => {
    const details = {
      assetKey: key,
      assetKind: kind,
      assetCategory: category,
      phase,
      cause: getErrorMessage(error),
    };

    if (asset?.type) details.type = asset.type;
    if (asset?.source) details.source = asset.source;
    if (asset?.url) details.url = truncateErrorValue(asset.url);
    if (asset?.buffer) details.bufferBytes = getBufferByteLength(asset.buffer);

    return details;
  };

  const createAssetLoadError = ({ key, category, phase, asset, error }) => {
    const kind = getAssetKindLabel(category, asset);
    const rootCauseMessage = getFriendlyCauseMessage({
      category,
      phase,
      error,
    });
    const message = `Could not load ${kind} "${key}". ${rootCauseMessage}`;
    const assetError = new Error(message, { cause: error });

    assetError.userMessage = message;
    assetError.rootCauseMessage = rootCauseMessage;
    assetError.details = getAssetErrorDetails({
      key,
      kind,
      category,
      phase,
      asset,
      error,
    });

    return assetError;
  };

  const loadAssetWithContext = async (
    { key, category, phase, asset },
    load,
  ) => {
    try {
      return await load();
    } catch (error) {
      throw createAssetLoadError({
        key,
        category,
        phase,
        asset,
        error,
      });
    }
  };

  const assertAssetBuffer = (asset, category) => {
    if (getBufferByteLength(asset?.buffer) === 0) {
      throw new Error(`${category} asset data is missing or empty.`);
    }
  };

  const quoteAssetName = (value) => {
    if (!value) return "unknown";
    return `"${String(value).replaceAll('"', '\\"')}"`;
  };

  const formatAssetFailureName = (failure) => {
    const { assetKind, assetKey } = failure?.details || {};
    if (!assetKey) return "unknown asset";
    if (!assetKind) return quoteAssetName(assetKey);
    return `${assetKind} ${quoteAssetName(assetKey)}`;
  };

  const formatAssetFailureNames = (failures) => {
    const maxVisibleFailures = 3;
    const visibleNames = failures
      .slice(0, maxVisibleFailures)
      .map(formatAssetFailureName);
    const hiddenCount = failures.length - visibleNames.length;
    const suffix = hiddenCount > 0 ? `, and ${hiddenCount} more` : "";

    return `${visibleNames.join(", ")}${suffix}`;
  };

  const throwAssetLoadFailures = (settledResults) => {
    const failures = settledResults
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    if (failures.length === 0) {
      return;
    }

    if (failures.length === 1) {
      throw failures[0];
    }

    const rootCauseMessage = "Check that the files exist and are supported.";
    const message = `Could not load ${failures.length} assets: ${formatAssetFailureNames(failures)}. ${rootCauseMessage}`;
    const aggregateError = new AggregateError(failures, message);

    aggregateError.userMessage = message;
    aggregateError.rootCauseMessage = rootCauseMessage;
    aggregateError.details = {
      failures: failures.map(
        (failure) =>
          failure?.details || {
            cause: getErrorMessage(failure),
          },
      ),
    };

    throw aggregateError;
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

  const waitForVideoReady = (video, key) =>
    new Promise((resolve, reject) => {
      const haveCurrentData = window.HTMLMediaElement?.HAVE_CURRENT_DATA ?? 2;

      if (video.readyState >= haveCurrentData) {
        resolve();
        return;
      }

      let timeoutId;
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("canplay", onReady);
        video.removeEventListener("error", onError);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        const details = [
          video.error?.code ? `code=${video.error.code}` : null,
          video.error?.message ? `message=${video.error.message}` : null,
          `networkState=${video.networkState}`,
          `readyState=${video.readyState}`,
          video.currentSrc ? `src=${video.currentSrc}` : null,
        ]
          .filter(Boolean)
          .join(", ");

        reject(
          new Error(
            `Failed to load video asset "${key}"${details ? ` (${details})` : ""}.`,
          ),
        );
      };

      timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out loading video asset "${key}".`));
      }, 5000);

      video.addEventListener("loadeddata", onReady, { once: true });
      video.addEventListener("canplay", onReady, { once: true });
      video.addEventListener("error", onError, { once: true });
    });

  const loadVideoTexture = async ({ key, sourceUrl, mimeType }) => {
    if (Assets.cache.has(key)) {
      return Assets.cache.get(key);
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    if (typeof mimeType === "string" && mimeType.length > 0) {
      video.type = mimeType;
    }
    const ready = waitForVideoReady(video, key);
    video.src = sourceUrl;
    video.load();

    await ready;

    const alphaMode = await detectVideoAlphaMode();
    const texture = new Texture({
      source: createVideoTextureSource(video, alphaMode),
    });
    configureManagedVideoTextureUpdates(texture);
    Assets.cache.set(key, texture);

    return texture;
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
    if (isDeepEqual(state, nextState)) {
      if (typeof appInstance.render === "function") {
        appInstance.render();
      }

      return;
    }

    const continuityPlan = buildAnimationContinuityPlan({
      prevState: state,
      nextState,
      activeAnimations: animationBus.getContinuableAnimations(),
    });

    if (renderAbortController) {
      renderAbortController.abort();
    }
    renderAbortController = new AbortController();
    const signal = renderAbortController.signal;

    // Reset completion tracker for new state (emits aborted if previous had pending)
    completionTracker.reset(nextState.id);

    applyGlobalObjects(appInstance, state.global, nextState.global);

    // Cancel any running animation that is not explicitly continuing.
    animationBus.cancelAllExcept(continuityPlan.continuedAnimationIds);

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

    if (
      animationPlaybackMode === "manual" &&
      animationPlaybackTimeMS !== null
    ) {
      animationBus.setTime(animationPlaybackTimeMS);
    }

    // Render audio
    renderAudio({
      app: appInstance,
      prevAudioTree: state.audio,
      nextAudioTree: nextState.audio,
      prevAudioEffects: state.audioEffects,
      nextAudioEffects: nextState.audioEffects,
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
      if (typeof app.render === "function") {
        app.render();
      }

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

    resumeAudio: () => audioStage.resume(),

    setAnimationPlaybackMode: (mode) => {
      assertAnimationPlaybackMode(mode);

      animationPlaybackMode = mode;

      if (animationPlaybackMode !== "manual") {
        animationPlaybackTimeMS = null;
        animationBus?.clearTime?.();
      }
    },

    setAnimationTime: (timeMS) => {
      const nextTime = Number(timeMS);
      if (!Number.isFinite(nextTime)) {
        throw new Error("Animation time must be a finite number.");
      }

      if (animationPlaybackMode === "manual") {
        animationPlaybackTimeMS = nextTime;
      }

      animationBus.flush();
      animationBus.setTime(nextTime);

      if (animationPlaybackMode !== "manual") {
        animationPlaybackTimeMS = null;
        animationBus.clearTime();
      }

      if (typeof app.render === "function") {
        app.render();
      }
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
        animationPlaybackMode: nextAnimationPlaybackMode = "auto",
      } = options;

      onFirstRenderCallback = onFirstRender;
      assertAnimationPlaybackMode(nextAnimationPlaybackMode);
      animationPlaybackMode = nextAnimationPlaybackMode;
      animationPlaybackTimeMS = null;
      animationBusListenerCleanup.forEach((cleanup) => cleanup());
      animationBusListenerCleanup = [];

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
        preserveDrawingBuffer: debug === true,
      });
      if (typeof app.ticker?.remove === "function") {
        app.ticker.remove(app.render, app);
      }
      app.debug = debug;
      app.inputDomBridge = createInputDomBridge({ app });
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
      const renderManualFrame = () => {
        if (
          animationPlaybackMode === "manual" &&
          typeof app.render === "function"
        ) {
          app.render();
        }
      };
      animationBusListenerCleanup = [
        animationBus.on("started", renderManualFrame),
        animationBus.on("completed", renderManualFrame),
        animationBus.on("cancelled", renderManualFrame),
      ];
      if (!debug) {
        frameTickerListener = (time) => {
          if (animationPlaybackMode !== "auto") {
            return;
          }

          animationBus.tick(time.deltaMS);
          if (typeof app.render === "function") {
            app.render();
          }
        };
        app.ticker.add(frameTickerListener);
      } else {
        debugAnimationListener = (event) => {
          if (animationPlaybackMode !== "auto") {
            return;
          }

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
      app?.inputDomBridge?.destroy?.();
      keyboardManager?.destroy();
      clearPendingSounds();
      animationBusListenerCleanup.forEach((cleanup) => cleanup());
      animationBusListenerCleanup = [];
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
        cleanupParticlesInTree({ app, root: app.stage });
      }

      if (app) app.destroy();
      animationPlaybackMode = "auto";
      animationPlaybackTimeMS = null;
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

      const loadJobs = [];

      Object.entries(assetsByType.audio).forEach(([key, asset]) => {
        loadJobs.push({
          includeInReturn: false,
          promise: loadAssetWithContext(
            {
              key,
              category: "audio",
              phase: "decode",
              asset,
            },
            async () => {
              assertAssetBuffer(asset, "Audio");
              return AudioAsset.load(key, asset.buffer);
            },
          ),
        });
      });

      Object.entries(assetsByType.font).forEach(([key, asset]) => {
        loadJobs.push({
          includeInReturn: false,
          promise: loadAssetWithContext(
            {
              key,
              category: "font",
              phase: "font face load",
              asset,
            },
            async () => {
              assertAssetBuffer(asset, "Font");
              const blob = new Blob([asset.buffer], { type: asset.type });
              const url = URL.createObjectURL(blob);
              // Use the key as font family name - this should match the fontFamily in text styles
              const fontFace = new FontFace(key, `url(${url})`);
              try {
                await fontFace.load();
                document.fonts.add(fontFace);
              } finally {
                URL.revokeObjectURL(url);
              }
            },
          ),
        });
      });

      Object.entries(assetsByType.texture).forEach(([key, asset]) =>
        loadJobs.push({
          includeInReturn: true,
          promise: loadAssetWithContext(
            {
              key,
              category: "texture",
              phase:
                asset?.source === "url" && typeof asset?.url === "string"
                  ? "Pixi URL load"
                  : "image bitmap creation",
              asset,
            },
            async () => {
              if (Assets.cache.has(key)) {
                return Assets.cache.get(key);
              }

              if (asset?.source === "url" && typeof asset?.url === "string") {
                return Assets.load({
                  alias: key,
                  src: asset.url,
                });
              }

              assertAssetBuffer(asset, "Texture");
              const blob = new Blob([asset.buffer], { type: asset.type });
              const imageBitmap = await createImageBitmap(blob);
              const texture = Texture.from(imageBitmap);

              // Alias the logical asset key so Texture.from("key") resolves
              // directly from the cache instead of attempting a relative URL fetch.
              Assets.cache.set(key, texture);

              return texture;
            },
          ),
        }),
      );

      // Load video assets via direct URL when possible, otherwise fall back
      // to a revokable blob URL for buffer-backed inputs.
      Object.entries(assetsByType.video).forEach(([key, asset]) => {
        loadJobs.push({
          includeInReturn: true,
          promise: loadAssetWithContext(
            {
              key,
              category: "video",
              phase: "video texture load",
              asset,
            },
            async () => {
              if (Assets.cache.has(key)) {
                return Assets.cache.get(key);
              }

              if (asset?.source !== "url") {
                assertAssetBuffer(asset, "Video");
              }

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

              try {
                return await loadVideoTexture({
                  key,
                  sourceUrl,
                  mimeType: asset?.type,
                });
              } catch (error) {
                videoSourceUrls.delete(key);
                if (isRevokableBlobUrl) {
                  URL.revokeObjectURL(sourceUrl);
                }
                throw error;
              }
            },
          ),
        });
      });

      const settledResults = await Promise.allSettled(
        loadJobs.map((job) => job.promise),
      );
      throwAssetLoadFailures(settledResults);

      return settledResults
        .map((result, index) =>
          loadJobs[index].includeInReturn && result.status === "fulfilled"
            ? result.value
            : undefined,
        )
        .filter(Boolean);
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
