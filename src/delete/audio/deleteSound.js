/**
 * @typedef {import('../../types.js').Application} Application
 * @typedef {import('../../types.js').SoundElement} SoundElement
 */

/**
 * @typedef {Object} DeleteSoundOptions
 * @property {Application} app - The PIXI application instance with audioStage
 * @property {SoundElement} soundASTNode - The sound element to delete
 * @property {AbortSignal} [signal] - Optional AbortSignal for cancellation
 */

/**
 * Deletes a sound element from the audio stage
 * @param {DeleteSoundOptions} options
 * @returns {Promise<void>}
 */
export const deleteSound = ({ app, soundASTNode, signal }) => {
  if (signal?.aborted) {
    return;
  }

  app.audioStage.remove(soundASTNode.id);
};
