import { parseCommonObject } from "../util/parseCommonObject.js";

/**
 *  @typedef {import('../../../types.js').BaseElement} BaseElement
 *  @typedef {import('../../../types.js').AnimatedSpriteASTNode} AnimatedSpriteASTNode
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The animated sprite state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @return {AnimatedSpriteASTNode}
 */
export const parseAnimatedSprite = ({ state }) => {
  const astObj = parseCommonObject(state);

  return {
    ...astObj,
    sheetSrc: state.sheetSrc ?? "",
    metadataSrc: state.metadataSrc ?? "",
    animation: state.animation ?? { frames: [], frameRate: 30, loop: true },
    alpha: state.alpha ?? 1,
  };
};
