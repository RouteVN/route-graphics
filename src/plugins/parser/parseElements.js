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
const parseElements = ({ JSONObject, parserPlugins = [] }) => {

  const parsedASTTree = JSONObject.map((node) => {
    const plugin = parserPlugins.find(p => p.type === node.type);
    if (!plugin) {
      throw new Error(`Unsupported element type: ${node.type}`);
    }
    return plugin.parse({ state: node, parserPlugins });
  });

  return parsedASTTree;
};

export default parseElements;
