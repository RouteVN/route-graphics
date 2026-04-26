import { parseCommonObject } from "../util/parseCommonObject.js";
import { normalizeBlurConfig } from "../util/blurEffect.js";
/**
 *  @typedef {import('../../../types.js').BaseElement} BaseElement
 *  @typedef {import('../../../types.js').SpriteComputedNode} SpriteComputedNode
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The sprite state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @return {SpriteComputedNode}
 */
export const parseSprite = ({ state }) => {
  const computedObj = parseCommonObject(state);

  return {
    ...computedObj,
    src: state.src ?? "",
    alpha: state.alpha ?? 1,
    ...(state.blur !== undefined && {
      blur: normalizeBlurConfig(state.blur),
    }),
    ...(state.hover && { hover: state.hover }),
    ...(state.click && { click: state.click }),
    ...(state.rightClick && { rightClick: state.rightClick }),
  };
};
