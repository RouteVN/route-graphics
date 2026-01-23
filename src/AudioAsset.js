const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const loadedAssets = {};

const load = async (key, arrayBuffer) => {
  if (loadedAssets[key]) {
    return;
  }
  if (arrayBuffer.byteLength === 0) {
    return;
  }
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  loadedAssets[key] = audioBuffer;
};

const getAsset = (url) => {
  const arrayBuffer = loadedAssets[url];
  return arrayBuffer;
};

export const AudioAsset = {
  load,
  getAsset,
};
