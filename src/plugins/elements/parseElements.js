/**
 * @typedef {import('../../types.js').BaseElement} BaseElement
 * @typedef {import('../../types.js').ComputedNode} ComputedNode
 */

/**
 *
 * @param {Object} params
 * @param {BaseElement[]} params.JSONObject - Array of elements to parse
 * @param {Array} params.parserPlugins - Array of parser plugins
 * @returns {ComputedNode[]}
 */
const parseElements = ({ JSONObject, parserPlugins = [] }) => {
  const parsedComputedTree = JSONObject.map((node) => {
    const plugin = parserPlugins.find((p) => p.type === node.type);
    if (!plugin) {
      throw new Error(
        `No parser plugin found for element type: ${node.type} (id: ${node.id ?? "unknown"})`,
      );
    }
    return plugin.parse({ state: node, parserPlugins });
  });

  return parsedComputedTree;
};

export { parseElements };
export default parseElements;
