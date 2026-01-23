import { parseCommonObject } from "../util/parseCommonObject.js";

/**
 *  @typedef {import('../../../types.js').BaseElement} BaseElement
 *  @typedef {import('../../../types.js').AnimatedSpriteComputedNode} AnimatedSpriteComputedNode
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The animated sprite state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @return {AnimatedSpriteComputedNode}
 */
export const parseAnimatedSprite = ({ state }) => {
  const computedObj = parseCommonObject(state);

  return {
    ...computedObj,
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
