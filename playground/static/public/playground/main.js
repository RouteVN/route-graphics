import jsYaml from "https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm";

const PLAYGROUND_RUNTIME_VERSION = "0.0.35";
const RUNTIME_SOURCES = [
  {
    label: "Local bundle",
    importer: () => import("/RouteGraphics.js"),
  },
  {
    label: `jsDelivr route-graphics@${PLAYGROUND_RUNTIME_VERSION}`,
    importer: () =>
      import(
        `https://cdn.jsdelivr.net/npm/route-graphics@${PLAYGROUND_RUNTIME_VERSION}/+esm`
      ),
  },
  {
    label: "jsDelivr route-graphics@0.0.34",
    importer: () =>
      import("https://cdn.jsdelivr.net/npm/route-graphics@0.0.34/+esm"),
  },
];

const loadRouteGraphics = async () => {
  const errors = [];

  for (const source of RUNTIME_SOURCES) {
    try {
      const module = await source.importer();
      return {
        label: source.label,
        module,
      };
    } catch (error) {
      console.warn(`Failed to load ${source.label}`, error);
      errors.push({ source: source.label, error });
    }
  }

  const failure = new Error(
    "Unable to load any Route Graphics runtime source.",
  );
  failure.causes = errors;
  throw failure;
};

const runtimeModuleResult = await loadRouteGraphics();
const routeGraphics = runtimeModuleResult.module;

const {
  default: createRouteGraphics,
  createAssetBufferManager,
  textPlugin,
  rectPlugin,
  spritePlugin,
  videoPlugin,
  sliderPlugin,
  inputPlugin,
  containerPlugin,
  textRevealingPlugin,
  animatedSpritePlugin,
  particlesPlugin,
  tweenPlugin,
  soundPlugin,
} = routeGraphics;

const templateInput = document.getElementById("input-template");
const highlightedTemplateInput = document.getElementById(
  "highlighted-input-template",
);
const highlightedTemplateInputContent = document.getElementById(
  "highlighted-input-template-content",
);
const outputCanvas = document.getElementById("output-canvas");
const exampleSelect = document.getElementById("template-select");
const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const stateIndicator = document.getElementById("state-indicator");
const errorOverlay = document.getElementById("error-overlay");
const errorMessage = document.getElementById("error-message");
const resetTemplateButton = document.getElementById("reset-template-button");
const copyYamlButton = document.getElementById("copy-yaml-button");
const runtimeSourceLabel = document.getElementById("runtime-source");
const clearEventsButton = document.getElementById("clear-events-button");
const eventLogEmpty = document.getElementById("event-log-empty");
const eventLog = document.getElementById("event-log");

let app;
let currentStates = [];
let currentStateIndex = 0;
let isInitialized = false;
let templatesCatalog = [];
let selectedTemplateId = "";
let editorBaselineValue = "";
const templatesById = new Map();
let supportedElementTypes = new Set();
const seenAssets = new Set();
const assetBufferManager = createAssetBufferManager();
const eventEntries = [];

const MAX_EVENT_LOG_ENTRIES = 40;
const searchParams = new URLSearchParams(window.location.search);
const requestedTemplateId = searchParams.get("template") ?? "";
const requestedSharedYaml = searchParams.get("yaml");
const requestedStateIndex = Math.max(
  0,
  (Number.parseInt(searchParams.get("state") ?? "1", 10) || 1) - 1,
);

const imageExtensions = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"],
  [".avif", "image/avif"],
  [".svg", "image/svg+xml"],
]);

const audioExtensions = new Map([
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
  [".ogg", "audio/ogg"],
  [".aac", "audio/aac"],
  [".m4a", "audio/mp4"],
  [".flac", "audio/flac"],
]);

const videoExtensions = new Map([
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".ogv", "video/ogg"],
  [".mov", "video/quicktime"],
  [".m4v", "video/mp4"],
]);

const privateAssets = {
  "circle-red": { type: "image/png", url: "/public/circle-red.png" },
  "circle-green": { type: "image/png", url: "/public/circle-green.png" },
  "circle-blue": { type: "image/png", url: "/public/circle-blue.png" },
  "particle-ember-core": {
    type: "image/svg+xml",
    url: "/public/particle-ember-core.svg",
  },
  "particle-ember-glow": {
    type: "image/svg+xml",
    url: "/public/particle-ember-glow.svg",
  },
  "particle-smoke-soft": {
    type: "image/svg+xml",
    url: "/public/particle-smoke-soft.svg",
  },
  "particle-smoke-ring": {
    type: "image/svg+xml",
    url: "/public/particle-smoke-ring.svg",
  },
  "particle-snow-crystal": {
    type: "image/svg+xml",
    url: "/public/particle-snow-crystal.svg",
  },
  "particle-snow-soft": {
    type: "image/svg+xml",
    url: "/public/particle-snow-soft.svg",
  },
  "particle-rain-streak": {
    type: "image/svg+xml",
    url: "/public/particle-rain-streak.svg",
  },
  "particle-rain-drop": {
    type: "image/svg+xml",
    url: "/public/particle-rain-drop.svg",
  },
  "particle-water-drop": {
    type: "image/svg+xml",
    url: "/public/particle-water-drop.svg",
  },
  "particle-water-splash": {
    type: "image/svg+xml",
    url: "/public/particle-water-splash.svg",
  },
  "particle-water-ripple": {
    type: "image/svg+xml",
    url: "/public/particle-water-ripple.svg",
  },
  "horizontal-idle-thumb": {
    type: "image/png",
    url: "/public/horizontal_idle_thumb.png",
  },
  "horizontal-hover-thumb": {
    type: "image/png",
    url: "/public/horizontal_hover_thumb.png",
  },
  "horizontal-idle-bar": {
    type: "image/png",
    url: "/public/horizontal_idle_bar.png",
  },
  "horizontal-hover-bar": {
    type: "image/png",
    url: "/public/horizontal_hover_bar.png",
  },
  "vertical-idle-thumb": {
    type: "image/png",
    url: "/public/vertical_idle_thumb.png",
  },
  "vertical-hover-thumb": {
    type: "image/png",
    url: "/public/vertical_hover_thumb.png",
  },
  "vertical-idle-bar": {
    type: "image/png",
    url: "/public/vertical_idle_bar.png",
  },
  "vertical-hover-bar": {
    type: "image/png",
    url: "/public/vertical_hover_bar.png",
  },
  slider: { type: "image/png", url: "/public/slider.png" },
  "bgm-1": { type: "audio/mpeg", url: "/public/bgm-1.mp3" },
  "bgm-2": { type: "audio/mpeg", url: "/public/bgm-2.mp3" },
  "bgm-3": { type: "audio/mpeg", url: "/public/bgm-3.mp3" },
  "video-sample": { type: "video/mp4", url: "/public/video_sample.mp4" },
  "video-sample-2": { type: "video/mp4", url: "/public/video_sample_2.mp4" },
};

const escapeHtml = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const dumpYaml = (value) =>
  jsYaml.dump(value, {
    lineWidth: -1,
    noRefs: true,
  });

const formatTimestamp = (date) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);

const stringifyPayload = (payload) => {
  if (payload === undefined) return "";
  if (typeof payload === "string") return payload;

  const seen = new WeakSet();

  try {
    return JSON.stringify(
      payload,
      (key, value) => {
        if (typeof value === "function") {
          return `[Function ${value.name || "anonymous"}]`;
        }

        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }

        return value;
      },
      2,
    );
  } catch (error) {
    return String(payload);
  }
};

const renderEventLog = () => {
  if (!eventLog || !eventLogEmpty) return;

  eventLog.innerHTML = "";

  if (eventEntries.length === 0) {
    eventLog.hidden = true;
    eventLogEmpty.hidden = false;
    return;
  }

  eventLog.hidden = false;
  eventLogEmpty.hidden = true;

  for (const entry of eventEntries) {
    const wrapper = document.createElement("div");
    wrapper.className = "event-log-entry";

    const header = document.createElement("div");
    header.className = "event-log-entry-header";

    const name = document.createElement("span");
    name.className = "event-log-entry-name";
    name.textContent =
      entry.source === "system" ? `[system] ${entry.name}` : entry.name;

    const timestamp = document.createElement("span");
    timestamp.textContent = formatTimestamp(entry.at);

    const body = document.createElement("pre");
    body.className = "event-log-entry-body";
    body.textContent = stringifyPayload(entry.payload) || "{}";

    header.append(name, timestamp);
    wrapper.append(header, body);
    eventLog.appendChild(wrapper);
  }
};

const pushEventLog = (name, payload, source = "event") => {
  eventEntries.unshift({
    name,
    payload,
    source,
    at: new Date(),
  });

  if (eventEntries.length > MAX_EVENT_LOG_ENTRIES) {
    eventEntries.length = MAX_EVENT_LOG_ENTRIES;
  }

  renderEventLog();
};

const clearEventLog = () => {
  eventEntries.length = 0;
  renderEventLog();
};

const showError = (message) => {
  errorOverlay.classList.add("show");
  errorMessage.textContent = message;
};

const hideError = () => {
  errorOverlay.classList.remove("show");
  errorMessage.textContent = "";
};

const setRuntimeSource = (text) => {
  if (runtimeSourceLabel) {
    runtimeSourceLabel.textContent = text;
  }
};

const getAssetExtension = (assetPath) => {
  if (typeof assetPath !== "string") return "";
  const sanitized = assetPath.split("?")[0].split("#")[0];
  const lastDot = sanitized.lastIndexOf(".");
  if (lastDot < 0) return "";
  return sanitized.slice(lastDot).toLowerCase();
};

const inferAssetType = (assetPath, fallbackType = "image/png") => {
  const ext = getAssetExtension(assetPath);
  if (imageExtensions.has(ext)) return imageExtensions.get(ext);
  if (audioExtensions.has(ext)) return audioExtensions.get(ext);
  if (videoExtensions.has(ext)) return videoExtensions.get(ext);
  return fallbackType;
};

const queueAsset = (assets, key, type) => {
  if (!key || typeof key !== "string" || seenAssets.has(key)) return;
  assets[key] = { type, url: key };
  seenAssets.add(key);
};

const recursivelyLoadAssets = (objects) => {
  const assets = {};

  const processObject = (obj) => {
    if (!obj || typeof obj !== "object") return;

    if (obj.type === "sound" && typeof obj.src === "string") {
      queueAsset(assets, obj.src, inferAssetType(obj.src, "audio/mpeg"));
    }

    if (obj.type === "video" && typeof obj.src === "string") {
      queueAsset(assets, obj.src, inferAssetType(obj.src, "video/mp4"));
    }

    if (
      obj.type === "animated-sprite" &&
      typeof obj.spritesheetSrc === "string"
    ) {
      queueAsset(
        assets,
        obj.spritesheetSrc,
        inferAssetType(obj.spritesheetSrc, "image/png"),
      );
    }

    for (const key of [
      "src",
      "thumbSrc",
      "barSrc",
      "inactiveBarSrc",
      "spritesheetSrc",
    ]) {
      if (key === "src" && obj.type === "sound") continue;
      if (obj[key] && typeof obj[key] === "string") {
        const defaultType = obj.type === "video" ? "video/mp4" : "image/png";
        queueAsset(assets, obj[key], inferAssetType(obj[key], defaultType));
      }
    }

    if (obj.soundSrc && typeof obj.soundSrc === "string") {
      queueAsset(
        assets,
        obj.soundSrc,
        inferAssetType(obj.soundSrc, "audio/mpeg"),
      );
    }

    for (const value of Object.values(obj)) {
      if (typeof value !== "object" || value === null) continue;

      if (Array.isArray(value)) {
        value.forEach(processObject);
      } else {
        processObject(value);
      }
    }
  };

  if (Array.isArray(objects)) {
    objects.forEach(processObject);
  } else {
    processObject(objects);
  }

  return assets;
};

const loadAssets = async (assets) => {
  if (Object.keys(assets).length === 0) return;
  await assetBufferManager.load(assets);
  await app.loadAssets(assetBufferManager.getBufferMap());
};

const preloadPrivateAssets = async () => {
  await loadAssets(privateAssets);
  Object.keys(privateAssets).forEach((key) => seenAssets.add(key));
};

const collectElementTypes = (states) => {
  const foundTypes = new Set();

  const processElementNode = (node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.type === "string") {
      foundTypes.add(node.type);
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(processElementNode);
    }
  };

  const stateArray = Array.isArray(states) ? states : [states];
  stateArray.forEach((state) => {
    if (!Array.isArray(state?.elements)) return;
    state.elements.forEach(processElementNode);
  });

  return foundTypes;
};

const getUnsupportedElementTypes = (states) => {
  const definedTypes = collectElementTypes(states);
  return [...definedTypes].filter((type) => !supportedElementTypes.has(type));
};

const loadTemplatesCatalog = async () => {
  const response = await fetch("/public/playground/templates.yaml");
  if (!response.ok) {
    throw new Error(`Failed to load templates catalog (${response.status})`);
  }

  const yamlText = await response.text();
  const parsedTemplates = jsYaml.load(yamlText);

  if (!Array.isArray(parsedTemplates)) {
    throw new Error("Templates catalog must be a YAML array.");
  }

  templatesCatalog = parsedTemplates;
  templatesById.clear();

  for (const template of templatesCatalog) {
    if (template?.id) {
      templatesById.set(template.id, template);
    }
  }

  if (!exampleSelect) return;

  exampleSelect.innerHTML = "";
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Select template";
  exampleSelect.appendChild(placeholderOption);

  for (const template of templatesCatalog) {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name || template.id;
    exampleSelect.appendChild(option);
  }
};

const updateAndHighlight = (highlightedInput, input) => {
  let text = input.value;
  if (text.endsWith("\n")) {
    text += " ";
  }

  highlightedInput.innerHTML = escapeHtml(text);
  Prism.highlightElement(highlightedInput);
};

const syncScroll = (highlightedElement, element) => {
  highlightedElement.scrollTop = element.scrollTop;
  highlightedElement.scrollLeft = element.scrollLeft;
};

const updateStateIndicator = () => {
  if (currentStates.length > 1) {
    stateIndicator.textContent = `${currentStateIndex + 1} of ${currentStates.length}`;
    stateIndicator.style.display = "inline";
    prevButton.style.display = "inline-block";
    nextButton.style.display = "inline-block";
    prevButton.disabled = currentStateIndex === 0;
    nextButton.disabled = currentStateIndex === currentStates.length - 1;
    return;
  }

  stateIndicator.style.display = "none";
  prevButton.style.display = "none";
  nextButton.style.display = "none";
};

const renderCurrentState = async () => {
  if (!isInitialized || !app || currentStates.length === 0) return;

  const currentState = currentStates[currentStateIndex];
  const assets = recursivelyLoadAssets(currentState);
  await loadAssets(assets);

  const state = {
    ...currentState,
    elements: currentState.elements || [],
    animations: currentState.animations || [],
    audio: currentState.audio || [],
  };

  app.render(state);
  updateStateIndicator();
};

const parseEditorStates = (yamlText) => {
  const parsed = jsYaml.load(yamlText);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!parsed || typeof parsed !== "object") {
    return [{}];
  }

  return [parsed];
};

const handleTextChange = async (options = {}) => {
  updateAndHighlight(highlightedTemplateInputContent, templateInput);

  try {
    hideError();

    const parsedStates = parseEditorStates(templateInput.value);
    currentStates = parsedStates;
    currentStateIndex = Math.min(
      Math.max(options.stateIndex ?? 0, 0),
      Math.max(parsedStates.length - 1, 0),
    );

    const unsupportedTypes = getUnsupportedElementTypes(currentStates);
    if (unsupportedTypes.length > 0) {
      showError(
        `Unsupported element type(s) in this playground runtime: ${unsupportedTypes.join(", ")}`,
      );
      return;
    }

    await renderCurrentState();
  } catch (error) {
    console.error("Rendering error:", error);

    if (error?.name === "YAMLException") {
      showError(`Invalid YAML: ${error.message}`);
      return;
    }

    showError(`Rendering failed: ${error.message}`);
  }
};

const setEditorValue = async (
  yamlText,
  { baselineValue, stateIndex = 0 } = {},
) => {
  templateInput.value = yamlText;
  editorBaselineValue = baselineValue ?? yamlText;
  await handleTextChange({ stateIndex });
};

const loadTemplateById = async (templateId, { stateIndex = 0 } = {}) => {
  const templateData = templatesById.get(templateId);
  if (!templateData?.content) {
    console.error("Template not found:", templateId);
    return;
  }

  selectedTemplateId = templateId;
  if (exampleSelect) {
    exampleSelect.value = templateId;
  }

  await setEditorValue(dumpYaml(templateData.content), { stateIndex });
  pushEventLog("template.load", { templateId }, "system");
};

const initRouteGraphics = async () => {
  try {
    app = createRouteGraphics();

    const elementPlugins = [
      textPlugin,
      rectPlugin,
      spritePlugin,
      videoPlugin,
      sliderPlugin,
      inputPlugin,
      containerPlugin,
      textRevealingPlugin,
      animatedSpritePlugin,
      particlesPlugin,
    ].filter(Boolean);

    supportedElementTypes = new Set(
      elementPlugins.map((plugin) => plugin.type),
    );

    const width = Math.max(outputCanvas.clientWidth, 640);
    const height = Math.max(outputCanvas.clientHeight, 360);

    await app.init({
      width,
      height,
      plugins: {
        elements: elementPlugins,
        animations: [tweenPlugin].filter(Boolean),
        audio: [soundPlugin].filter(Boolean),
      },
      backgroundColor: 0x000000,
      eventHandler: (eventName, payload) => {
        pushEventLog(eventName, payload);
        console.log("Route Graphics Event:", eventName, payload);
      },
    });

    outputCanvas.appendChild(app.canvas);
    isInitialized = true;

    setRuntimeSource(runtimeModuleResult.label);
    pushEventLog(
      "runtime.ready",
      {
        source: runtimeModuleResult.label,
        version: PLAYGROUND_RUNTIME_VERSION,
      },
      "system",
    );
  } catch (error) {
    console.error("Failed to initialize Route Graphics:", error);
    outputCanvas.style.display = "none";
    const errorMsg = document.createElement("div");
    errorMsg.textContent = `Failed to initialize Route Graphics: ${error.message}`;
    outputCanvas.parentElement.appendChild(errorMsg);
  }
};

const handlePrevScene = async () => {
  if (currentStateIndex === 0) return;
  currentStateIndex -= 1;

  try {
    hideError();
    await renderCurrentState();
    pushEventLog("state.previous", { state: currentStateIndex + 1 }, "system");
  } catch (error) {
    console.error("Rendering error:", error);
    showError(`Rendering failed: ${error.message}`);
  }
};

const handleNextScene = async () => {
  if (currentStateIndex >= currentStates.length - 1) return;
  currentStateIndex += 1;

  try {
    hideError();
    await renderCurrentState();
    pushEventLog("state.next", { state: currentStateIndex + 1 }, "system");
  } catch (error) {
    console.error("Rendering error:", error);
    showError(`Rendering failed: ${error.message}`);
  }
};

const writeClipboardText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
};

const handleResetTemplate = async () => {
  await setEditorValue(editorBaselineValue, { stateIndex: 0 });
  pushEventLog(
    "template.reset",
    { templateId: selectedTemplateId || null },
    "system",
  );
};

const handleCopyYaml = async () => {
  try {
    await writeClipboardText(templateInput.value);
    pushEventLog("clipboard.copy-yaml", { status: "ok" }, "system");
  } catch (error) {
    console.error("Failed to copy YAML:", error);
    pushEventLog(
      "clipboard.copy-yaml",
      { status: "failed", message: error.message },
      "system",
    );
  }
};

const loadInitialTemplate = async () => {
  if (requestedTemplateId && templatesById.has(requestedTemplateId)) {
    await loadTemplateById(requestedTemplateId, {
      stateIndex: requestedStateIndex,
    });
    return;
  }

  if (requestedSharedYaml) {
    selectedTemplateId = "";
    if (exampleSelect) {
      exampleSelect.value = "";
    }

    await setEditorValue(requestedSharedYaml, {
      baselineValue: requestedSharedYaml,
      stateIndex: requestedStateIndex,
    });
    pushEventLog("template.load-shared-yaml", {}, "system");
    return;
  }

  const fallbackTemplate = templatesCatalog[0];
  if (fallbackTemplate?.id) {
    await loadTemplateById(fallbackTemplate.id);
    return;
  }

  const defaultContent = {
    elements: [
      {
        id: "welcome-text",
        type: "text",
        x: 640,
        y: 360,
        content: "Hello, Route-Graphics!",
        anchorX: 0.5,
        anchorY: 0.5,
        textStyle: {
          fill: "#ffffff",
          fontSize: 32,
          align: "center",
        },
      },
    ],
  };

  selectedTemplateId = "";
  await setEditorValue(dumpYaml(defaultContent));
};

const injectEventListeners = () => {
  templateInput.addEventListener("input", () => {
    handleTextChange().catch((error) => {
      console.error("Failed to render updated YAML:", error);
      showError(`Rendering failed: ${error.message}`);
    });
  });

  templateInput.addEventListener("scroll", () =>
    syncScroll(highlightedTemplateInput, templateInput),
  );

  exampleSelect.addEventListener("change", () => {
    const templateId = exampleSelect.value;
    if (!templateId) return;

    loadTemplateById(templateId).catch((error) => {
      console.error("Failed to load template:", error);
      showError(`Failed to load template: ${error.message}`);
    });
  });

  prevButton?.addEventListener("click", () => {
    handlePrevScene();
  });

  nextButton?.addEventListener("click", () => {
    handleNextScene();
  });

  resetTemplateButton?.addEventListener("click", () => {
    handleResetTemplate();
  });

  copyYamlButton?.addEventListener("click", () => {
    handleCopyYaml();
  });

  clearEventsButton?.addEventListener("click", () => {
    clearEventLog();
  });
};

const init = async () => {
  renderEventLog();
  await initRouteGraphics();
  await preloadPrivateAssets();
  await loadTemplatesCatalog();
  injectEventListeners();
  await loadInitialTemplate();
};

init().catch((error) => {
  console.error("Failed to boot playground:", error);
  showError(`Failed to boot playground: ${error.message}`);
});
