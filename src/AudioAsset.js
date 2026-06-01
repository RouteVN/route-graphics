import {
  decodeOggToAudioBuffer,
  isOggAudioType,
  prepareOggDecoders,
} from "./audio/oggDecoderFallback.js";

let audioContext;

const loadedAssets = {};
const loadingAssets = {};

const getAudioContext = () => {
  if (audioContext) return audioContext;

  const AudioContextCtor =
    globalThis.window?.AudioContext ?? globalThis.window?.webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error("AudioContext is not available in this environment.");
  }

  audioContext = new AudioContextCtor();
  return audioContext;
};

const prepareDecoders = async (assetMap) => {
  await prepareOggDecoders(assetMap);
};

const decodeAudio = async ({ key, arrayBuffer, type, audioContext }) => {
  try {
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } catch (error) {
    if (!isOggAudioType(type)) {
      console.error(`AudioAsset.load: Failed to decode ${key}:`, error);
      return;
    }

    try {
      return await decodeOggToAudioBuffer({
        arrayBuffer,
        audioContext,
      });
    } catch (fallbackError) {
      console.error(`AudioAsset.load: Failed to decode ${key}:`, fallbackError);
    }
  }
};

const load = (key, arrayBuffer, type) => {
  if (loadedAssets[key]) {
    return loadedAssets[key];
  }
  if (loadingAssets[key]) {
    return loadingAssets[key];
  }
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return;
  }

  const context = getAudioContext();
  loadingAssets[key] = decodeAudio({
    key,
    arrayBuffer,
    type,
    audioContext: context,
  })
    .then((audioBuffer) => {
      if (audioBuffer) {
        loadedAssets[key] = audioBuffer;
      }
      return audioBuffer;
    })
    .finally(() => {
      delete loadingAssets[key];
    });

  return loadingAssets[key];
};

const getAsset = (url) => {
  const arrayBuffer = loadedAssets[url];
  return arrayBuffer;
};

export const AudioAsset = {
  prepareDecoders,
  load,
  getAsset,
};
