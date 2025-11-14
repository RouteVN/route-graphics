/**
 * Base interface for all audio plugins
 * Each audio plugin must export: type, add, update, delete
 */

/**
 * @typedef {Object} AudioPlugin
 * @property {string} type - The audio type this plugin handles
 * @property {Function} add - Function to add the audio element
 * @property {Function} update - Function to update the audio element
 * @property {Function} delete - Function to delete the audio element
 */

/**
 * @typedef {Object} AddAudioOptions
 * @property {import('../../types.js').Application} app - The PixiJS application
 * @property {import('../../types.js').SoundElement} audio - Audio element to add
 * @property {AbortSignal} signal - Abort signal
 */

/**
 * @typedef {Object} UpdateAudioOptions
 * @property {import('../../types.js').Application} app - The PixiJS application
 * @property {import('../../types.js').SoundElement} prevAudio - Previous audio state
 * @property {import('../../types.js').SoundElement} nextAudio - Next audio state
 * @property {AbortSignal} signal - Abort signal
 */

/**
 * @typedef {Object} DeleteAudioOptions
 * @property {import('../../types.js').Application} app - The PixiJS application
 * @property {import('../../types.js').SoundElement} audio - Audio element to delete
 * @property {AbortSignal} signal - Abort signal
 */

/**
 * Creates an audio plugin with the required interface
 * @param {Object} options - Plugin configuration
 * @param {string} options.type - Audio type
 * @param {Function} options.add - Add function
 * @param {Function} options.update - Update function
 * @property {Function} options.delete - Delete function
 * @returns {AudioPlugin} Audio plugin
 */
export const createAudioPlugin = ({ type, add, update, delete: deleteFn }) => ({
  type,
  add,
  update,
  delete: deleteFn,
});
