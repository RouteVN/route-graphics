/**
 * @typedef {import('../../types.js').Application} Application
 * @typedef {import('../../types.js').SoundElement} SoundElement
 */

/**
 * @typedef {Object} UpdateSoundOptions
 * @property {Application} app - The PIXI application instance with audioStage
 * @property {SoundElement} prevSoundASTNode - The previous sound element state
 * @property {SoundElement} nextSoundASTNode - The next sound element state
 * @property {AbortSignal} [signal] - Optional AbortSignal for cancellation
 */

/**
 * Updates a sound element on the audio stage
 * @param {UpdateSoundOptions} options
 * @returns {Promise<void>}
 */
export const updateSound = ({
  app,
  prevSoundASTNode,
  nextSoundASTNode,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  // Only update if src or volume changed (based on AudioPlugin logic)
  if (
    prevSoundASTNode.src !== nextSoundASTNode.src ||
    prevSoundASTNode.volume !== nextSoundASTNode.volume
  ) {
    const audioElement = app.audioStage.getById(prevSoundASTNode.id);
    if (audioElement) {
      audioElement.url = nextSoundASTNode.src;
      audioElement.volume = (nextSoundASTNode.volume ?? 800) / 1000;
    }
  }
};
