import { getAudioContext } from "./audioContext.js";

const loadedAssets = {};
const loadingAssets = {};

const getErrorMessage = (error) => {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  return error.message || String(error);
};

const createAudioDecodeError = (key, error) => {
  const rootCauseMessage = "Unsupported or damaged audio file.";
  const message = `Could not load audio "${key}". ${rootCauseMessage}`;
  const audioError = new Error(message, {
    cause: error,
  });

  audioError.userMessage = message;
  audioError.rootCauseMessage = rootCauseMessage;
  audioError.details = {
    assetKey: key,
    assetKind: "audio",
    phase: "decode",
    cause: getErrorMessage(error),
  };

  return audioError;
};

const load = (key, arrayBuffer) => {
  if (loadedAssets[key]) {
    return loadedAssets[key];
  }
  if (loadingAssets[key]) {
    return loadingAssets[key];
  }
  if (arrayBuffer.byteLength === 0) {
    return;
  }

  // decodeAudioData may detach its input. Decode a private copy so callers can
  // reuse manager-owned buffers after unload or application recreation.
  const decodeBuffer = arrayBuffer.slice(0);
  const loadPromise = getAudioContext()
    .decodeAudioData(decodeBuffer)
    .then((audioBuffer) => {
      if (loadingAssets[key] === loadPromise) {
        loadedAssets[key] = audioBuffer;
      }
      return audioBuffer;
    })
    .catch((error) => {
      throw createAudioDecodeError(key, error);
    })
    .finally(() => {
      if (loadingAssets[key] === loadPromise) {
        delete loadingAssets[key];
      }
    });

  loadingAssets[key] = loadPromise;
  return loadPromise;
};

const getAsset = (url) => {
  const arrayBuffer = loadedAssets[url];
  return arrayBuffer;
};

const unload = (key) => {
  const hadAsset = !!loadedAssets[key] || !!loadingAssets[key];
  delete loadedAssets[key];
  delete loadingAssets[key];
  return hadAsset;
};

export const AudioAsset = {
  load,
  getAsset,
  unload,
};
