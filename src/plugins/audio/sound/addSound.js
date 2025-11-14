/**
 * Add sound element to the audio stage
 * @param {Object} params
 * @param {import('../../../types.js').Application} params.app - The PIXI application instance with audioStage
 * @param {import('../../../types.js').SoundElement} params.element - The sound element to add
 * @param {AbortSignal} params.signal - Optional AbortSignal for cancellation
 */
export const addSound = ({ app, element, signal }) => {
  if (signal?.aborted) {
    return;
  }

  const audioElement = {
    id: element.id,
    url: element.src,
    loop: element.loop ?? false,
    volume: (element.volume ?? 800) / 1000,
  };

  if (element.delay && element.delay > 0) {
    setTimeout(() => {
      if (!signal?.aborted) {
        app.audioStage.add(audioElement);
      }
    }, element.delay);
  } else {
    app.audioStage.add(audioElement);
  }
};
