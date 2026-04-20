import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const IMAGE_MIME_TYPES = new Map([
  [".apng", "image/apng"],
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const AUDIO_MIME_TYPES = new Map([
  [".aac", "audio/aac"],
  [".flac", "audio/flac"],
  [".m4a", "audio/mp4"],
  [".mp3", "audio/mpeg"],
  [".oga", "audio/ogg"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
]);

const VIDEO_MIME_TYPES = new Map([
  [".mov", "video/quicktime"],
  [".mp4", "video/mp4"],
  [".ogv", "video/ogg"],
  [".webm", "video/webm"],
]);

const FONT_MIME_TYPES = new Map([
  [".otf", "font/otf"],
  [".ttf", "font/ttf"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const CONFIG_ONLY_KEYS = new Set([
  "assets",
  "backgroundColor",
  "height",
  "state",
  "states",
  "width",
]);

const DIRECT_ASSET_KEYS = new Set([
  "barSrc",
  "inactiveBarSrc",
  "soundSrc",
  "src",
  "thumbSrc",
]);

const isPlainObject = (value) => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const getPathExtension = (value) => {
  if (typeof value !== "string") return "";

  const normalized = value.split("?")[0].split("#")[0];

  return path.extname(normalized).toLowerCase();
};

const parseFileUrl = (value) => {
  try {
    return fileURLToPath(value);
  } catch {
    return null;
  }
};

const isRemoteAssetUrl = (value) => {
  if (typeof value !== "string") return false;

  return /^(https?:)?\/\//i.test(value) || value.startsWith("data:");
};

const isFileUrl = (value) => {
  return typeof value === "string" && value.startsWith("file:");
};

const isAbsoluteWindowsPath = (value) => {
  return typeof value === "string" && /^[a-zA-Z]:[\\/]/.test(value);
};

const looksLikeLocalAssetPath = (value) => {
  if (typeof value !== "string" || value.length === 0) return false;

  if (isRemoteAssetUrl(value) || isFileUrl(value)) {
    return true;
  }

  if (
    path.isAbsolute(value) ||
    isAbsoluteWindowsPath(value) ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("/") ||
    value.includes("/") ||
    value.includes("\\")
  ) {
    return true;
  }

  return (
    IMAGE_MIME_TYPES.has(getPathExtension(value)) ||
    AUDIO_MIME_TYPES.has(getPathExtension(value)) ||
    VIDEO_MIME_TYPES.has(getPathExtension(value)) ||
    FONT_MIME_TYPES.has(getPathExtension(value))
  );
};

const inferMimeType = (assetPath, fallbackType = "image/png") => {
  const extension = getPathExtension(assetPath);

  if (IMAGE_MIME_TYPES.has(extension)) {
    return IMAGE_MIME_TYPES.get(extension);
  }

  if (AUDIO_MIME_TYPES.has(extension)) {
    return AUDIO_MIME_TYPES.get(extension);
  }

  if (VIDEO_MIME_TYPES.has(extension)) {
    return VIDEO_MIME_TYPES.get(extension);
  }

  if (FONT_MIME_TYPES.has(extension)) {
    return FONT_MIME_TYPES.get(extension);
  }

  return fallbackType;
};

const normalizeState = (value, index = 0) => {
  if (!isPlainObject(value)) {
    throw new Error(`State at index ${index} must be a YAML object.`);
  }

  return {
    ...value,
    id: value.id ?? `state-${index}`,
    elements: Array.isArray(value.elements) ? value.elements : [],
    animations: Array.isArray(value.animations) ? value.animations : [],
    audio: Array.isArray(value.audio) ? value.audio : [],
    global: isPlainObject(value.global) ? value.global : {},
  };
};

const extractStateFromConfigObject = (value) => {
  const state = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (CONFIG_ONLY_KEYS.has(key)) continue;
    state[key] = entryValue;
  }

  return state;
};

const normalizeTopLevelDocument = (document) => {
  if (Array.isArray(document)) {
    return {
      width: undefined,
      height: undefined,
      backgroundColor: undefined,
      assets: {},
      states: document.map((state, index) => normalizeState(state, index)),
    };
  }

  if (!isPlainObject(document)) {
    throw new Error(
      "YAML root must be an object, an array of states, or a multi-document state list.",
    );
  }

  const { width, height, backgroundColor, assets, state, states } = document;

  if (Array.isArray(states)) {
    return {
      width,
      height,
      backgroundColor,
      assets: isPlainObject(assets) ? assets : {},
      states: states.map((entry, index) => normalizeState(entry, index)),
    };
  }

  if (isPlainObject(state)) {
    return {
      width,
      height,
      backgroundColor,
      assets: isPlainObject(assets) ? assets : {},
      states: [normalizeState(state, 0)],
    };
  }

  return {
    width,
    height,
    backgroundColor,
    assets: isPlainObject(assets) ? assets : {},
    states: [normalizeState(extractStateFromConfigObject(document), 0)],
  };
};

const loadRenderDefinition = (yamlSource) => {
  const documents = [];
  yaml.loadAll(yamlSource, (document) => {
    if (document !== undefined && document !== null) {
      documents.push(document);
    }
  });

  if (documents.length === 0) {
    throw new Error("YAML file did not contain any documents.");
  }

  if (documents.length === 1) {
    return normalizeTopLevelDocument(documents[0]);
  }

  return {
    width: undefined,
    height: undefined,
    backgroundColor: undefined,
    assets: {},
    states: documents.map((document, index) => normalizeState(document, index)),
  };
};

const normalizeAssetConfigEntry = (rawValue, fallbackType, baseDir) => {
  if (typeof rawValue === "string") {
    const type = inferMimeType(rawValue, fallbackType);

    if (isRemoteAssetUrl(rawValue)) {
      return {
        type,
        kind: "remote",
        url: rawValue,
      };
    }

    if (isFileUrl(rawValue)) {
      return {
        type,
        kind: "local",
        path: parseFileUrl(rawValue),
      };
    }

    return {
      type,
      kind: "local",
      path: path.resolve(baseDir, rawValue),
    };
  }

  if (!isPlainObject(rawValue)) {
    throw new Error("Asset entries must be a string or an object.");
  }

  const sourceValue = rawValue.path ?? rawValue.url ?? rawValue.src;

  if (typeof sourceValue !== "string" || sourceValue.length === 0) {
    throw new Error("Asset object entries must provide path, url, or src.");
  }

  return normalizeAssetConfigEntry(
    sourceValue,
    rawValue.type ?? fallbackType,
    baseDir,
  );
};

const collectAssetDefinitions = ({ assets = {}, states = [], baseDir }) => {
  const definitions = {};

  const register = (key, rawValue, fallbackType = "image/png") => {
    if (typeof key !== "string" || key.length === 0 || definitions[key]) {
      return;
    }

    definitions[key] = normalizeAssetConfigEntry(
      rawValue,
      fallbackType,
      baseDir,
    );
  };

  for (const [key, value] of Object.entries(assets)) {
    register(key, value);
  }

  const walk = (node) => {
    if (!isPlainObject(node) && !Array.isArray(node)) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (node.type === "sound" && typeof node.src === "string") {
      register(node.src, node.src, "audio/mpeg");
    }

    if (node.type === "video" && typeof node.src === "string") {
      register(node.src, node.src, "video/mp4");
    }

    for (const [key, value] of Object.entries(node)) {
      if (DIRECT_ASSET_KEYS.has(key) && typeof value === "string") {
        const isAudioReference =
          key === "soundSrc" || (key === "src" && node.type === "sound");
        const fallbackType = isAudioReference
          ? "audio/mpeg"
          : node.type === "video"
            ? "video/mp4"
            : "image/png";

        if (definitions[value] || !looksLikeLocalAssetPath(value)) {
          continue;
        }

        register(value, value, fallbackType);
      }

      if (Array.isArray(value) || isPlainObject(value)) {
        walk(value);
      }
    }
  };

  walk(states);

  return definitions;
};

const parseBackgroundColor = (value, fallback = 0x000000) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    throw new Error("Background color must be a number or a string.");
  }

  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return Number.parseInt(trimmed.slice(1), 16);
  }

  if (/^0x[0-9a-fA-F]{6}$/.test(trimmed)) {
    return Number.parseInt(trimmed.slice(2), 16);
  }

  if (/^[0-9]+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  throw new Error(`Unsupported background color format: ${value}`);
};

export {
  collectAssetDefinitions,
  inferMimeType,
  loadRenderDefinition,
  looksLikeLocalAssetPath,
  parseBackgroundColor,
};
