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
  "hoverSrc",
  "inactiveBarSrc",
  "pressSrc",
  "soundSrc",
  "src",
  "thumbSrc",
]);

const FONT_ASSET_KEYS = new Set(["fontFamily"]);

const NON_RENDER_BRANCH_KEYS = new Set(["payload"]);

const FIXED_ASSET_FALLBACK_TYPES = new Map([
  ["barSrc", "image/png"],
  ["hoverSrc", "image/png"],
  ["inactiveBarSrc", "image/png"],
  ["pressSrc", "image/png"],
  ["soundSrc", "audio/mpeg"],
  ["thumbSrc", "image/png"],
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

const getNextNodePath = (currentPath, key) => {
  if (typeof key === "number") {
    return `${currentPath}[${key}]`;
  }

  return `${currentPath}.${key}`;
};

const detectMimeType = (assetPath) => {
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

  return undefined;
};

const inferSrcFallbackType = ({ node, ancestry }) => {
  const typedNodes = [node, ...ancestry.slice().reverse()];

  for (const typedNode of typedNodes) {
    if (!isPlainObject(typedNode) || typeof typedNode.type !== "string") {
      continue;
    }

    if (typedNode.type === "sound") {
      return "audio/mpeg";
    }

    if (typedNode.type === "video") {
      return "video/mp4";
    }
  }

  return "image/png";
};

const getRequiredAssetFallbackType = ({ key, node, ancestry }) => {
  if (key === "src") {
    return inferSrcFallbackType({
      node,
      ancestry,
    });
  }

  return FIXED_ASSET_FALLBACK_TYPES.get(key) ?? "image/png";
};

const getAssetSourceValue = (rawValue) => {
  if (typeof rawValue === "string") {
    return rawValue;
  }

  if (!isPlainObject(rawValue)) {
    return undefined;
  }

  return rawValue.path ?? rawValue.url ?? rawValue.src;
};

const getExplicitAssetType = (rawValue) => {
  if (!isPlainObject(rawValue)) {
    return undefined;
  }

  return typeof rawValue.type === "string" && rawValue.type.length > 0
    ? rawValue.type
    : undefined;
};

const collectAssetReferences = ({ states, assetAliases }) => {
  const references = new Map();

  const registerReference = ({ alias, fallbackType, nodePath }) => {
    const record = references.get(alias);

    if (!record) {
      references.set(alias, {
        fallbackTypes: new Set([fallbackType]),
        nodePaths: [nodePath],
      });
      return;
    }

    record.fallbackTypes.add(fallbackType);
    record.nodePaths.push(nodePath);
  };

  const walk = (node, nodePath, ancestry = []) => {
    if (!isPlainObject(node) && !Array.isArray(node)) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((value, index) => {
        walk(value, getNextNodePath(nodePath, index), ancestry);
      });
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      const nextPath = getNextNodePath(nodePath, key);

      if (NON_RENDER_BRANCH_KEYS.has(key)) {
        continue;
      }

      if (DIRECT_ASSET_KEYS.has(key) && typeof value === "string") {
        if (assetAliases.has(value)) {
          registerReference({
            alias: value,
            fallbackType: getRequiredAssetFallbackType({
              key,
              node,
              ancestry,
            }),
            nodePath: nextPath,
          });
        } else if (looksLikeLocalAssetPath(value)) {
          throw new Error(
            `Direct asset references are not supported. Define "${value}" in top-level assets and reference its alias instead (at ${nextPath}).`,
          );
        } else {
          throw new Error(
            `Asset alias "${value}" referenced at ${nextPath} is not defined in top-level assets.`,
          );
        }
      }

      if (
        FONT_ASSET_KEYS.has(key) &&
        typeof value === "string" &&
        assetAliases.has(value)
      ) {
        registerReference({
          alias: value,
          fallbackType: "font/ttf",
          nodePath: nextPath,
        });
      }

      if (Array.isArray(value) || isPlainObject(value)) {
        walk(value, nextPath, [...ancestry, node]);
      }
    }
  };

  walk(states, "states");

  return references;
};

const inferMimeType = (assetPath, fallbackType = "image/png") => {
  return detectMimeType(assetPath) ?? fallbackType;
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
    audioEffects: Array.isArray(value.audioEffects) ? value.audioEffects : [],
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
  const assetAliases = new Set(Object.keys(assets));
  const references = collectAssetReferences({
    states,
    assetAliases,
  });
  const definitions = {};

  for (const [key, reference] of references.entries()) {
    const rawValue = assets[key];
    const explicitType = getExplicitAssetType(rawValue);
    const sourceValue = getAssetSourceValue(rawValue);
    const detectedType = sourceValue ? detectMimeType(sourceValue) : undefined;
    const fallbackTypes = [...reference.fallbackTypes];

    if (fallbackTypes.length > 1 && !explicitType && !detectedType) {
      throw new Error(
        `Asset alias "${key}" is referenced as multiple asset types (${fallbackTypes.join(", ")} at ${reference.nodePaths.join(", ")}). Define assets.${key}.type explicitly.`,
      );
    }

    definitions[key] = normalizeAssetConfigEntry(
      rawValue,
      fallbackTypes[0],
      baseDir,
    );
  }

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
  parseBackgroundColor,
};
