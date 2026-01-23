/**
 * @typedef {Object} AnimationPlugin
 * @property {string} type - The animation type this plugin handles
 */

/**
 * Creates an animation plugin with the required interface
 * @param {Object} options - Plugin configuration
 * @param {string} options.type - Animation type
 * @returns {AnimationPlugin} Animation plugin
 */
export const createAnimationPlugin = ({ type }) => ({
  type,
});
