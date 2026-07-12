let audioContext;

const isAudioDebugEnabled = () =>
  globalThis.window?.RTGL_AUDIO_DEBUG === true ||
  globalThis.window?.RTGL_VT_DEBUG === true;

const debugAudioContext = (message, details = {}) => {
  if (!isAudioDebugEnabled()) {
    return;
  }

  console.log(`[AudioContext] ${message}`, details);
};

export const getAudioContext = () => {
  if (audioContext) return audioContext;

  const AudioContextCtor =
    globalThis.window?.AudioContext ?? globalThis.window?.webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error("AudioContext is not available in this environment.");
  }

  audioContext = new AudioContextCtor();
  debugAudioContext("context created", { state: audioContext.state });
  return audioContext;
};
