const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const loadedAssets = {};
const loadingAssets = {};

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

  loadingAssets[key] = audioContext
    .decodeAudioData(arrayBuffer)
    .then((audioBuffer) => {
      loadedAssets[key] = audioBuffer;
      return audioBuffer;
    })
    .catch((error) => {
      console.error(`AudioAsset.load: Failed to decode ${key}:`, error);
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
  load,
  getAsset,
};
