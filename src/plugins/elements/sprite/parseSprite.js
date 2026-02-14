import { parseCommonObject } from "../util/parseCommonObject.js";
import { cloneSerializableData } from "../../../util/cloneSerializableData.js";
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
    ...(state.hover && { hover: cloneSerializableData(state.hover) }),
    ...(state.click && { click: cloneSerializableData(state.click) }),
    ...(state.rightClick && {
      rightClick: cloneSerializableData(state.rightClick),
    }),
  };
};
