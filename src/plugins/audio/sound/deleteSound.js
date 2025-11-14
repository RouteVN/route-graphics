/**
 * Delete sound element from the audio stage
 * @param {Object} params
 * @param {import('../../../types.js').Application} params.app - The PIXI application instance with audioStage
 * @param {import('../../../types.js').SoundElement} params.element - The sound element to delete
 * @param {AbortSignal} params.signal - Optional AbortSignal for cancellation
 */
export const deleteSound = ({ app, element, signal }) => {
  if (signal?.aborted) {
    return;
  }

  app.audioStage.remove(element.id);
};
