import { parseCommonObject } from "../util/parseCommonObject.js";
import { cloneSerializableData } from "../../../util/cloneSerializableData.js";
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

  let finalObj = computedObj;

  if (state.border) {
    finalObj = {
      ...computedObj,
      border: {
        alpha: state.border?.alpha ?? 1,
        color: state.border?.color ?? "black",
        width: state.border?.width ?? 0,
      },
    };
  }

  return {
    ...finalObj,
    fill: state.fill ?? "white",
    rotation: state.rotation ?? 0,
    ...(state.drag && { drag: cloneSerializableData(state.drag) }),
    ...(state.rightClick && {
      rightClick: cloneSerializableData(state.rightClick),
    }),
    ...(state.scroll && { scroll: cloneSerializableData(state.scroll) }),
  };
};
