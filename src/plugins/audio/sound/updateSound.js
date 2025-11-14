/**
 * Update sound element on the audio stage
 * @param {Object} params
 * @param {import('../../../types.js').Application} params.app - The PIXI application instance with audioStage
 * @param {import('../../../types.js').SoundElement} params.prevElement - The previous sound element state
 * @param {import('../../../types.js').SoundElement} params.nextElement - The next sound element state
 * @param {AbortSignal} params.signal - Optional AbortSignal for cancellation
 */
export const updateSound = ({ app, prevElement, nextElement, signal }) => {
  if (signal?.aborted) {
    return;
  }

  // Only update if src or volume changed (based on AudioPlugin logic)
  if (
    prevElement.src !== nextElement.src ||
    prevElement.volume !== nextElement.volume
  ) {
    const audioElement = app.audioStage.getById(prevElement.id);
    if (audioElement) {
      audioElement.url = nextElement.src;
      audioElement.volume = (nextElement.volume ?? 800) / 1000;
    }
  }
};
