const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const loadedAssets = {};

const load = async (key, arrayBuffer) => {
  if (loadedAssets[key]) {
    return;
  }
  if (arrayBuffer.byteLength === 0) {
    return;
  }
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    loadedAssets[key] = audioBuffer;
  } catch (error) {
    console.error(`AudioAsset.load: Failed to decode ${key}:`, error);
  }
};

const getAsset = (url) => {
  const arrayBuffer = loadedAssets[url];
  return arrayBuffer;
};

export const AudioAsset = {
  load,
  getAsset,
};
