n/**
 * Global parser registry to store all available parser plugins
 */
let parserPlugins = [];

/**
 * Register parser plugins
 * @param {Array} plugins - Array of parser plugins
 */
export const registerParserPlugins = (plugins) => {
  parserPlugins = plugins;
};

/**
 * Get all registered parser plugins
 * @returns {Array} Array of parser plugins
 */
export const getParserPlugins = () => parserPlugins;

/**
 * Get a parser plugin by type
 * @param {string} type - The parser type to find
 * @returns {Object|null} The parser plugin or null if not found
 */
export const getParserPlugin = (type) => {
  return parserPlugins.find(p => p.type === type) || null;
};