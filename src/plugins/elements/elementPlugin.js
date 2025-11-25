/**
 * Base interface for all element plugins
 * Each element plugin must export: type, add, update, delete
 */

/**
 * @typedef {Object} ElementPlugin
 * @property {string} type - The element type this plugin handles
 * @property {Function} add - Function to add the element
 * @property {Function} update - Function to update the element
 * @property {Function} delete - Function to delete the element
 */

/**
 * @typedef {Object} AddElementOptions
 * @property {import('../../types.js').Application} app - The PixiJS application
 * @property {import('../../types.js').Container} parent - Parent container
 * @property {import('../../types.js').ASTNode} element - Element to add
 * @property {Object[]} animations - Animation configurations for the element
 * @property {Function} eventHandler - Event handler function
 * @property {Array} animationPlugins - Array of animation plugins
 * @property {AbortSignal} signal - Abort signal
 */

/**
 * @typedef {Object} UpdateElementOptions
 * @property {import('../../types.js').Application} app - The PixiJS application
 * @property {import('../../types.js').Container} parent - Parent container
 * @property {import('../../types.js').ASTNode} prevElement - Previous element state
 * @property {import('../../types.js').ASTNode} nextElement - Next element state
 * @property {Object[]} animations - Animation configurations for the element
 * @property {Function} eventHandler - Event handler function
 * @property {Array} animationPlugins - Array of animation plugins
 * @property {AbortSignal} signal - Abort signal
 */

/**
 * @typedef {Object} DeleteElementOptions
 * @property {import('../../types.js').Application} app - The PixiJS application
 * @property {import('../../types.js').Container} parent - Parent container
 * @property {import('../../types.js').ASTNode} element - Element to delete
 * @property {Object[]} animations - Animation configurations for the element
 * @property {Array} animationPlugins - Array of animation plugins
 * @property {AbortSignal} signal - Abort signal
 */

/**
 * Creates an element plugin with the required interface
 * @param {Object} options - Plugin configuration
 * @param {string} options.type - Element type
 * @param {Function} options.add - Add function
 * @param {Function} options.update - Update function
 * @param {Function} options.delete - Delete function
 * @param {import('../parser/parserPlugin.js').ParseOption} options.parse
 * @returns {ElementPlugin} Element plugin
 */
export const createElementPlugin = ({
  type,
  add,
  update,
  delete: deleteFn,
  parse,
}) => ({
  type,
  add,
  update,
  delete: deleteFn,
  parse,
});
