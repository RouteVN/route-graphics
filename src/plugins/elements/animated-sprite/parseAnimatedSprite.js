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
    spritesheetSrc: state.spritesheetSrc ?? "",
    spritesheetData: { frames: {}, meta: {}, ...(state.spritesheetData ?? {}) },
    animation: {
      frames: [],
      animationSpeed: 0.5,
      loop: true,
      ...(state.animation ?? {}),
    },
    alpha: state.alpha ?? 1,
  };
};
