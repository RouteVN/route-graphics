/**
 * @typedef {Function} ParseOption
 * @property {Object} state
 */

/**
 * @typedef {Object} ParserPlugin
 * @property {String} type
 * @property {Function} parse
 */

/**
 *
 * @param {Object} Options
 * @param {String} Options.type
 * @param {Function} Options.parse
 * @returns {ParserPlugin}
 */
export const createParserPlugin = ({ type, parse }) => ({
  type,
  parse,
});
