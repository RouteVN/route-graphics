import { registerParserPlugins, getParserPlugin } from "./parserRegistry.js";

/**
 * @typedef {import('../../types.js').BaseElement} BaseElement
 * @typedef {import('../../types.js').ASTNode} ASTNode
 */

/**
 *
 * @param {Object} params
 * @param {BaseElement[]} params.JSONObject - Array of elements to parse
 * @param {Array} params.parserPlugins - Array of parser plugins
 * @returns {ASTNode[]}
 */
const parseElements = ({ JSONObject, parserPlugins }) => {
  // Register the passed plugins
  registerParserPlugins(parserPlugins);

  const parsedASTTree = JSONObject.map((node) => {
    const plugin = getParserPlugin(node.type);
    if (!plugin) {
      throw new Error(`Unsupported element type: ${node.type}`);
    }
    return plugin.parse(node);
  });

  return parsedASTTree;
};

export default parseElements;
