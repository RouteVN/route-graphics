/**
 * Base interface for all animation plugins
 * Each animation plugin must export: type, animate
 */

/**
 * @typedef {Object} AnimationPlugin
 * @property {string} type - The animation type this plugin handles
 * @property {Function} animate - Function to execute the animation
 */

/**
 * @typedef {Object} AnimateOptions
 * @property {import('../../types.js').Application} app - The PixiJS application
 * @property {import('pixi.js').DisplayObject} element - Element to animate
 * @property {Object} animation - Animation configuration
 * @property {AbortSignal} signal - Abort signal
 * @property {Function} eventHandler - Event handler function for emitting events
 */

/**
 * Creates an animation plugin with the required interface
 * @param {Object} options - Plugin configuration
 * @param {string} options.type - Animation type
 * @param {Function} options.animate - Animation function
 * @returns {AnimationPlugin} Animation plugin
 */
export const createAnimationPlugin = ({ type, animate }) => ({
  type,
  animate,
});
