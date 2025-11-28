import { parseCommonObject } from "../util/parseCommonObject.js";
/**
 *  @typedef {import('../../../types.js').BaseElement}
 *  @typedef {import('../../../types.js').RectASTNode}
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The rect state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @return {RectASTNode}
 */
export const parseRect = ({ state }) => {
  const astObj = parseCommonObject(state);

  let finalObj = astObj;

  if (state.border) {
    finalObj = {
      ...astObj,
      border: {
        alpha: state.border?.alpha ?? 1,
        color: state.border?.color ?? "black",
        width: state.border?.width ?? 0,
      },
    };
  }

  return {
    ...finalObj,
    cursor: state.cursor ?? "",
    fill: state.fill ?? "white",
    pointerDown: state.pointerDown ?? "",
    pointerMove: state.pointerMove ?? "",
    pointerUp: state.pointerUp ?? "",
    rotation: state.rotation ?? 0,
    ...(state.drag && { drag: state.drag }),
  };
};
