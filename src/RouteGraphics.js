import {
  Application,
  Assets,
  Graphics,
  LoaderParserPriority,
  extensions,
  ExtensionType,
  Texture,
} from "pixi.js";
import "@pixi/unsafe-eval";
import { createAudioStage } from "./AudioStage.js";
import parseElements from "./plugins/elements/parseElements.js";
import { AudioAsset } from "./AudioAsset.js";
import { renderElements } from "./plugins/elements/renderElements.js";
import { renderAudio } from "./plugins/audio/renderAudio.js";
import { createParserPlugin } from "./plugins/elements/parserPlugin.js";

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
    };

    return output;
  },

  test: async (_) => true,

  testParse: async (_) => true,

  parse: async (asset) => {
    // If asset is already a Texture, return it directly
    if (asset instanceof Texture) {
      return asset;
    }

    // Convert ArrayBuffer to Blob
    const blob = new Blob([asset.data], { type: asset.type });

    // Convert Blob to ImageBitmap
    const imageBitmap = await createImageBitmap(blob);

    // Create and return Texture
    return new Texture.from(imageBitmap);
  },

  unload: async (texture) => texture.destroy(true),
});

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
   * @type {AbortController}
   */
  let currentAbortController;

  /**
   * @type {boolean}
   */
  let isProcessingRender = false;

  /**
   * @type {ReturnType<ReturnType<typeof createAdvancedBufferLoader>>}
   */
  let advancedLoader;

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

  /**
   * Apply global cursor styles to the PixiJS application
   * @param {Application} appInstance - The PixiJS application instance
   * @param {GlobalConfiguration} [prevGlobal] - Previous global configuration
   * @param {GlobalConfiguration} [nextGlobal] - Next global configuration
   */
  const applyGlobalCursorStyles = (appInstance, prevGlobal, nextGlobal) => {
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
    if (JSON.stringify(prevCursorStyles) !== JSON.stringify(nextCursorStyles)) {
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
   * Render function
   * @param {Application} appInstance
   * @param {RouteGraphicsState} prevState
   * @param {RouteGraphicsState} nextState
   * @param {Function} handler
   */
  const renderInternal = async (appInstance, parent, nextState, handler) => {
    applyGlobalCursorStyles(appInstance, state.global, nextState.global);
    if (currentAbortController && isProcessingRender)
      currentAbortController.abort();
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    //We are doing this in case render is called more than once consecutively, we need to make sure that
    //the first render call has been completed before the second one begins.
    while (isProcessingRender) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    isProcessingRender = true;
    await renderElements({
      app: appInstance,
      parent,
      prevASTTree: state.elements,
      nextASTTree: nextState.elements,
      animations: nextState.animations,
      elementPlugins: plugins.elements,
      animationPlugins: plugins.animations,
      eventHandler: handler,
      signal,
    });

    await renderAudio({
      app: appInstance,
      prevAudioTree: state.audio,
      nextAudioTree: nextState.audio,
      audioPlugins: plugins.audio,
      signal,
    });
    isProcessingRender = false;
    state = nextState;
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

    extractBase64: async (element) => {
      await app.renderer.extract.base64(element);
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
        useCustomTicker = false,
      } = options;

      const parserPlugins = [];

      pluginConfig?.elements?.forEach((plugin) => {
        if (plugin?.parse)
          parserPlugins.push(
            createParserPlugin({ type: plugin.type, parse: plugin.parse }),
          );
      });

      plugins = {
        animations: pluginConfig.animations ?? [],
        elements: pluginConfig.elements ?? [],
        audio: pluginConfig.audio ?? [],
        parsers: parserPlugins,
      };
      eventHandler = handler;

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
      app.useCustomTicker = useCustomTicker;

      const graphics = new Graphics();
      graphics.rect(0, 0, width, height);
      graphics.fill(backgroundColor || 0x000000);
      app.stage.addChild(graphics);
      app.stage.width = width;
      app.stage.height = height;
      app.ticker.add(app.audioStage.tick);

      return routeGraphicsInstance;
    },

    destroy: () => {
      app.audioStage.destroy();
      app.destroy();
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
      console.log("Assets classified by type:", assetsByType);

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

      Object.entries(assetsByType.video).forEach(([key, asset]) => {
        console.log("Video asset loading not implemented yet:", key);
        console.log("Video asset loading not implemented yet:", asset);
        Assets.load({src: asset, alias: key});
      });

      if (!advancedLoader) {
        advancedLoader = createAdvancedBufferLoader(assetsByType.texture);

        Assets.loader.parsers.length = 0;
        Assets.reset();
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

      const urls = Object.keys(assetsByType.texture);
      return Promise.all(urls.map((url) => Assets.load(url)));
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
      const parsedElements = parseElements({
        JSONObject: stateParam.elements,
        parserPlugins: plugins.parsers,
      });
      const parsedState = { ...stateParam, elements: parsedElements };
      renderInternal(app, app.stage, parsedState, eventHandler);
    },

    /**
     * Parse elements from state object using registered parser plugins
     * @param {RouteGraphicsState} stateParam - The state object containing element definitions
     */
    parse: (stateParam) => {
      const parsedElements = parseElements({
        JSONObject: stateParam.elements,
        parserPlugins: plugins.parsers,
      });
      const parsedState = { ...stateParam, elements: parsedElements };
      return parsedState;
    },
  };

  return routeGraphicsInstance;
};

export default createRouteGraphics;
