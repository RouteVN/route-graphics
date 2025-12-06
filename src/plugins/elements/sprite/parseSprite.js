import { parseCommonObject } from "../util/parseCommonObject.js";
/**
 *  @typedef {import('../../../types.js').BaseElement} BaseElement
 *  @typedef {import('../../../types.js').SpriteASTNode} SpriteASTNode
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The sprite state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @return {SpriteASTNode}
 */
export const parseSprite = ({ state }) => {
  const astObj = parseCommonObject(state);

  return {
    ...astObj,
    src: state.src ?? "",
    alpha: state.alpha ?? 1,
    cursor: state.cursor ?? "",
  };
};
