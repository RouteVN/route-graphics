/**
 * @typedef {import('../../types.js').Application} Application
 * @typedef {import('../../types.js').SoundElement} SoundElement
 */

/**
 * @typedef {Object} AddSoundOptions
 * @property {Application} app - The PIXI application instance with audioStage
 * @property {SoundElement} soundASTNode - The sound element to add
 * @property {AbortSignal} [signal] - Optional AbortSignal for cancellation
 */

/**
 * Adds a sound element to the audio stage
 * @param {AddSoundOptions} options
 * @returns {Promise<void>}
 */
export const addSound = ({ app, soundASTNode, signal }) => {
  if (signal?.aborted) {
    return;
  }

  const audioElement = {
    id: soundASTNode.id,
    url: soundASTNode.src,
    loop: soundASTNode.loop ?? false,
    volume: (soundASTNode.volume ?? 800) / 1000,
  };

  if (soundASTNode.delay && soundASTNode.delay > 0) {
    setTimeout(() => {
      if (!signal?.aborted) {
        app.audioStage.add(audioElement);
      }
    }, soundASTNode.delay);
  } else {
    app.audioStage.add(audioElement);
  }
}
