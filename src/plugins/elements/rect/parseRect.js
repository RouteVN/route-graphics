import { parseCommonObject } from "../util/parseCommonObject.js";
/**
 *  @typedef {import('../../../types.js').BaseElement}
 *  @typedef {import('../../../types.js').RectComputedNode}
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The rect state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @return {RectComputedNode}
 */
export const parseRect = ({ state }) => {
  const computedObj = parseCommonObject(state);
  const borderWidth = state.border?.width;

  let finalObj = computedObj;

  if (typeof borderWidth === "number" && borderWidth > 0) {
    finalObj = {
      ...computedObj,
      border: {
        alpha: state.border?.alpha ?? 1,
        color: state.border?.color ?? "black",
        width: borderWidth,
      },
    };
  }

  return {
    ...finalObj,
    ...(state.fill !== undefined ? { fill: state.fill } : {}),
    rotation: state.rotation ?? 0,
    ...(state.drag && { drag: state.drag }),
    ...(state.rightClick && { rightClick: state.rightClick }),
    ...(state.scrollUp && { scrollUp: state.scrollUp }),
    ...(state.scrollDown && { scrollDown: state.scrollDown }),
  };
};
